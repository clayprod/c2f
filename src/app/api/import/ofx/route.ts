import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseOFX } from '@/services/import/ofxParser';
import { createErrorResponse } from '@/lib/errors';

interface ImportOptions {
  categories?: Record<string, string>; // transaction id -> category id
  selected_ids?: string[]; // only import these transactions
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ofx_content, account_id, categories, selected_ids } = body as {
      ofx_content: string;
      account_id?: string;
      categories?: Record<string, string>;
      selected_ids?: string[];
    };

    if (!ofx_content) {
      return NextResponse.json({ error: 'OFX content is required' }, { status: 400 });
    }

    // Parse OFX
    const ofxData = parseOFX(ofx_content);
    if (!ofxData) {
      return NextResponse.json(
        { error: 'Erro ao processar arquivo OFX. Verifique o formato.' },
        { status: 400 }
      );
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

    // Filter transactions if selected_ids provided
    let transactionsToImport = ofxData.transactions;
    if (selected_ids && selected_ids.length > 0) {
      const selectedSet = new Set(selected_ids);
      transactionsToImport = ofxData.transactions.filter(tx => selectedSet.has(tx.fitId));
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
        const accountName = ofxData.account.accountId
          ? `Conta ${ofxData.account.accountType || 'Importada'} - ${ofxData.account.accountId.slice(-4)}`
          : 'Conta Importada OFX';

        const { data: newAccount } = await supabase
          .from('accounts')
          .insert({
            user_id: userId,
            name: accountName,
            type: 'checking',
            current_balance: ofxData.balance || 0,
            institution: ofxData.account.bankId || null,
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

    // Get or create "OUTROS" category as fallback
    let fallbackCategoryId: string | null = null;
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
          .eq('provider_tx_id', tx.fitId)
          .maybeSingle();

        if (existingById) {
          skipped++;
          continue;
        }

        // Check by content as fallback
        const { data: existingByContent } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('posted_at', tx.date)
          .eq('description', tx.description)
          .eq('amount', tx.amount)
          .maybeSingle();

        if (existingByContent) {
          skipped++;
          continue;
        }

        // Determine category - use provided category or fallback
        const categoryId = categories?.[tx.fitId] || fallbackCategoryId;

        // Insert transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: defaultAccountId,
            category_id: categoryId,
            posted_at: tx.date,
            description: tx.description,
            amount: tx.amount,
            currency: ofxData.account.currency || 'BRL',
            source: 'import',
            provider_tx_id: tx.fitId,
            notes: `Importado via OFX - ${tx.type}`,
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
