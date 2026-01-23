import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Get reconciliation data for linked accounts
 * Compares balances and lists unimported transactions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('link_id');

    // Get account links
    let linksQuery = supabase
      .from('account_links')
      .select(`
        id,
        pluggy_account_id,
        internal_account_id,
        pluggy_accounts!inner (
          id,
          pluggy_account_id,
          name,
          balance_cents,
          currency,
          item_id,
          institution_logo,
          pluggy_items!inner (
            connector_name
          )
        ),
        accounts!inner (
          id,
          name,
          current_balance,
          currency
        )
      `)
      .eq('user_id', user.id);

    if (linkId) {
      linksQuery = linksQuery.eq('id', linkId);
    }

    const { data: links, error: linksError } = await linksQuery;

    if (linksError) {
      console.error('Error fetching links:', linksError);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    if (!links || links.length === 0) {
      return NextResponse.json({
        links: [],
        summary: {
          total_divergence: 0,
          total_unimported: 0,
        },
      });
    }

    // For credit cards, calculate balance as sum of unpaid bills (open/closed)
    const creditCardIds = (links || [])
      .filter((link: any) => link.accounts.type === 'credit_card')
      .map((link: any) => link.accounts.id);

    let cardBalances = new Map<string, number>();
    if (creditCardIds.length > 0) {
      // Get unpaid bills for credit cards
      const { data: bills, error: billsError } = await supabase
        .from('credit_card_bills')
        .select('account_id, total_cents, paid_cents')
        .eq('user_id', user.id)
        .in('account_id', creditCardIds)
        .in('status', ['open', 'closed']);

      if (!billsError && bills) {
        // Calculate total unpaid amount per card
        bills.forEach((bill: any) => {
          const unpaid = (bill.total_cents || 0) - (bill.paid_cents || 0);
          const current = cardBalances.get(bill.account_id) || 0;
          cardBalances.set(bill.account_id, current + unpaid);
        });
      }
    }

    // For each link, get unimported transactions count
    const reconciliationData = await Promise.all(
      links.map(async (link: any) => {
        const { count: unimportedCount } = await supabase
          .from('pluggy_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('account_id', link.pluggy_accounts.pluggy_account_id)
          .is('imported_at', null);

        // Mantém valores em centavos para consistência
        const pluggyBalanceCents = link.pluggy_accounts.balance_cents;
        
        // For credit cards, use calculated unpaid balance instead of current_balance
        let internalBalanceReais = link.accounts.current_balance || 0;
        if (link.accounts.type === 'credit_card') {
          const unpaidBalanceCents = cardBalances.get(link.accounts.id) || 0;
          internalBalanceReais = unpaidBalanceCents / 100; // Convert to reais
        }
        
        // accounts.current_balance está em reais, converter para centavos
        const internalBalanceCents = Math.round(internalBalanceReais * 100);
        const divergenceCents = pluggyBalanceCents - internalBalanceCents;

        return {
          link_id: link.id,
          pluggy_account: {
            id: link.pluggy_accounts.id,
            pluggy_account_id: link.pluggy_accounts.pluggy_account_id,
            name: link.pluggy_accounts.name,
            balance_cents: pluggyBalanceCents,
            currency: link.pluggy_accounts.currency,
            institution: link.pluggy_accounts.pluggy_items?.connector_name || 'Open Finance',
            institution_logo: link.pluggy_accounts.institution_logo || null,
          },
          internal_account: {
            id: link.accounts.id,
            name: link.accounts.name,
            balance_cents: internalBalanceCents,
            currency: link.accounts.currency,
          },
          divergence_cents: divergenceCents,
          unimported_count: unimportedCount || 0,
        };
      })
    );

    const summary = {
      total_divergence_cents: reconciliationData.reduce((sum, r) => sum + Math.abs(r.divergence_cents), 0),
      total_unimported: reconciliationData.reduce((sum, r) => sum + r.unimported_count, 0),
    };

    return NextResponse.json({
      links: reconciliationData,
      summary,
    });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/reconcile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
