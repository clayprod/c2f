import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { projectionCache } from '@/services/projections/cache';

interface TransactionToImport {
  id: string;
  category_id?: string | null;
}

/**
 * Import selected Pluggy transactions to main transactions table
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { link_id, transactions: transactionsToImport } = body as {
      link_id: string;
      transactions: TransactionToImport[];
    };

    if (!link_id || !transactionsToImport || transactionsToImport.length === 0) {
      return NextResponse.json(
        { error: 'link_id and transactions are required' },
        { status: 400 }
      );
    }

    // Get the link to find the internal account
    const { data: link, error: linkError } = await supabase
      .from('account_links')
      .select('internal_account_id')
      .eq('id', link_id)
      .eq('user_id', user.id)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const internalAccountId = link.internal_account_id;

    // Get the pluggy transactions
    const transactionIds = transactionsToImport.map(t => t.id);
    const { data: pluggyTransactions, error: txError } = await supabase
      .from('pluggy_transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('id', transactionIds)
      .is('imported_at', null);

    if (txError) {
      console.error('Error fetching pluggy transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!pluggyTransactions || pluggyTransactions.length === 0) {
      return NextResponse.json({ error: 'No valid transactions to import' }, { status: 400 });
    }

    // Get or create "OUTROS" category as fallback
    let fallbackCategoryId: string | null = null;
    const { data: outrosCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', 'outros')
      .maybeSingle();

    if (outrosCategory) {
      fallbackCategoryId = outrosCategory.id;
    } else {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
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

    // Create a map of transaction IDs to category IDs from the request
    const categoryMap = new Map(
      transactionsToImport.map(t => [t.id, t.category_id])
    );

    // Import each transaction
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const pluggyTx of pluggyTransactions) {
      try {
        // Determine the category
        const requestedCategoryId = categoryMap.get(pluggyTx.id);
        const categoryId = requestedCategoryId || fallbackCategoryId;

        // Create the transaction
        // Apply sign based on type: debit = negative (expense), credit = positive (income)
        const amountCents = Number(pluggyTx.amount_cents) || 0;
        const signedAmountCents = pluggyTx.type === 'debit' ? -Math.abs(amountCents) : Math.abs(amountCents);
        const signedAmountReais = signedAmountCents / 100;

        const { data: newTx, error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            account_id: internalAccountId,
            category_id: categoryId,
            posted_at: pluggyTx.date,
            description: pluggyTx.description,
            amount: signedAmountReais,
            currency: pluggyTx.currency || 'BRL',
            source: 'pluggy',
            provider_tx_id: pluggyTx.pluggy_transaction_id,
            notes: `Importado via Open Finance - ${pluggyTx.type === 'debit' ? 'despesa' : 'receita'}`,
          })
          .select('id')
          .single();

        if (insertError) {
          if (insertError.code === '23505') { // Unique violation - already imported
            results.skipped++;
          } else {
            console.error('Error inserting transaction:', insertError);
            const errorDetail = insertError.message || 'Erro desconhecido';
            results.errors.push(`Erro ao importar: ${pluggyTx.description} - ${errorDetail}`);
          }
          continue;
        }

        // Mark as imported
        await supabase
          .from('pluggy_transactions')
          .update({
            imported_at: new Date().toISOString(),
            imported_transaction_id: newTx?.id,
          })
          .eq('id', pluggyTx.id);

        results.imported++;
      } catch (error: any) {
        console.error('Error importing transaction:', error);
        results.errors.push(`Erro ao importar: ${pluggyTx.description}`);
      }
    }

    projectionCache.invalidateUser(user.id);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Error in POST /api/pluggy/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
