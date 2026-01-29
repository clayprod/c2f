import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseCSV } from '@/services/import/csvParser';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';
import {
  matchTransactions,
  createCategories,
  updateTransactionsWithNewCategories,
  type CategoryToCreate,
} from '@/services/import/categoryMatcher';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { csv_content, account_id, categories_to_create, selected_ids } = body as {
      csv_content: string;
      account_id?: string;
      categories_to_create?: CategoryToCreate[];
      selected_ids?: string[];
    };

    if (!csv_content) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    // Parse CSV
    const allTransactions = parseCSV(csv_content);

    // Filter by selected_ids if provided
    let transactionsToImport = allTransactions;
    if (selected_ids && selected_ids.length > 0) {
      const selectedSet = new Set(selected_ids);
      transactionsToImport = allTransactions.filter(tx => selectedSet.has(tx.id));
    }

    const supabase = await createClient();
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .insert({
        user_id: userId,
        status: 'processing',
        file_url: null,
      })
      .select()
      .single();

    if (importError) {
      throw importError;
    }

    const totalRows = transactionsToImport.length;

    if (totalRows === 0) {
      await supabase
        .from('imports')
        .update({ status: 'completed', error_message: 'Nenhuma transação selecionada' })
        .eq('id', importRecord.id);

      return NextResponse.json({
        success: true,
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: [],
      });
    }

    // Get or create default account - always use the selected account
    let defaultAccountId = account_id;
    if (!defaultAccountId) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (accounts) {
        defaultAccountId = accounts.id;
      } else {
        const { data: newAccount } = await supabase
          .from('accounts')
          .insert({
            user_id: userId,
            name: 'Conta Principal',
            type: 'checking',
            current_balance: 0,
          })
          .select()
          .single();

        if (newAccount) {
          defaultAccountId = newAccount.id;
        }
      }
    }

    if (!defaultAccountId) {
      throw new Error('Não foi possível criar ou encontrar uma conta para importação');
    }

    // Get existing categories
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId);

    // Step 1: Match transactions with existing categories
    const matchingResult = matchTransactions(
      transactionsToImport.map((tx, index) => ({
        id: tx.id || `csv-${index}`,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        categoryName: tx.categoryName,
        accountName: tx.accountName,
      })),
      existingCategories || [],
      [], // We don't need accounts here, we use the selected one
      defaultAccountId
    );

    // Step 2: Create categories that need to be created
    let finalTransactions = matchingResult.transactions;
    
    if (categories_to_create && categories_to_create.length > 0) {
      try {
        const createdCategoriesMap = await createCategories(
          categories_to_create,
          userId,
          supabase
        );
        
        // Update transactions with newly created category IDs
        finalTransactions = updateTransactionsWithNewCategories(
          matchingResult.transactions,
          createdCategoriesMap
        );
      } catch (error) {
        console.error('Error creating categories:', error);
        errors.push('Erro ao criar algumas categorias');
      }
    }

    // Step 3: Get or create fallback category
    let fallbackCategoryId: string | undefined = undefined;
    const { data: outrosCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', 'outros')
      .maybeSingle();

    if (outrosCategory) {
      fallbackCategoryId = outrosCategory.id;
    } else {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: 'OUTROS',
          type: 'expense',
          icon: '📦',
          color: '#808080',
        })
        .select()
        .single();

      if (newCategory) {
        fallbackCategoryId = newCategory.id;
      }
    }

    // Step 4: Process transactions
    for (const tx of finalTransactions) {
      try {
        // Check for duplicates
        const { data: existingById } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('provider_tx_id', tx.id)
          .maybeSingle();

        if (existingById) {
          skipped++;
          continue;
        }

        // Determine amount (with sign)
        const signedAmount = tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);

        // Check by content as fallback
        const { data: existingByContent } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('posted_at', tx.date)
          .eq('description', tx.description)
          .eq('amount', signedAmount)
          .maybeSingle();

        if (existingByContent) {
          skipped++;
          continue;
        }

        // Use transaction's category_id or fallback
        const categoryId = tx.category_id || fallbackCategoryId;

        // Insert transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: defaultAccountId,
            category_id: categoryId,
            posted_at: tx.date,
            description: tx.description,
            amount: signedAmount,
            currency: 'BRL',
            source: 'import',
            provider_tx_id: tx.id,
            notes: `Importado via CSV - ${tx.type}`,
          });

        if (txError) {
          errors.push(`Erro ao importar transação: ${txError.message}`);
          continue;
        }

        imported++;
      } catch (error: any) {
        errors.push(`Erro ao processar transação: ${error.message}`);
      }
    }

    // Update import record
    const status = errors.length > 0 && imported === 0 ? 'failed' : 'completed';
    await supabase
      .from('imports')
      .update({
        status,
        error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      })
      .eq('id', importRecord.id);

    projectionCache.invalidateUser(userId);

    return NextResponse.json({
      success: status === 'completed',
      totalRows,
      imported,
      skipped,
      errors: errors.slice(0, 10),
      importId: importRecord.id,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
