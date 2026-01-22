import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseCSV } from '@/services/import/csvParser';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { csv_content, account_id, categories, selected_ids } = body as {
      csv_content: string;
      account_id?: string;
      categories?: Record<string, string>;
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

    // Get or create default account
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
    const categoryMap = new Map<string, string>();
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId);

    if (existingCategories) {
      for (const cat of existingCategories) {
        categoryMap.set(`${cat.name.toLowerCase()}_${cat.type}`, cat.id);
        categoryMap.set(cat.id, cat.id); // Also allow by ID
      }
    }

    // Get or create fallback category
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

    // Process transactions
    for (const tx of transactionsToImport) {
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

        // Determine category - priority: 1) provided by user, 2) from CSV, 3) fallback
        let categoryId = categories?.[tx.id];
        
        if (!categoryId) {
          const categoryKey = `${tx.categoryName.toLowerCase()}_${tx.type}`;
          categoryId = categoryMap.get(categoryKey);
          
          // If category from CSV doesn't exist, create it
          if (!categoryId && tx.categoryName && tx.categoryName.toLowerCase() !== 'outros') {
            const { data: newCategory } = await supabase
              .from('categories')
              .insert({
                user_id: userId,
                name: tx.categoryName,
                type: tx.type,
                icon: tx.type === 'income' ? '💰' : '💸',
                color: tx.type === 'income' ? '#22c55e' : '#ef4444',
              })
              .select()
              .single();

            if (newCategory) {
              categoryId = newCategory.id;
              categoryMap.set(categoryKey, newCategory.id);
            }
          }
        }

        if (!categoryId) {
          categoryId = fallbackCategoryId;
        }

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
