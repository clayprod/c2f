import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Get Pluggy accounts that are not yet linked to internal accounts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all Pluggy accounts
    const { data: pluggyAccounts, error: pluggyError } = await supabase
      .from('pluggy_accounts')
      .select(`
        id,
        pluggy_account_id,
        name,
        type,
        subtype,
        balance_cents,
        currency,
        number,
        item_id,
        institution_logo,
        pluggy_items!inner (
          connector_name,
          connector_id,
          status
        )
      `)
      .eq('user_id', user.id);

    if (pluggyError) {
      console.error('Error fetching pluggy accounts:', pluggyError);
      return NextResponse.json({ error: 'Failed to fetch accounts', details: pluggyError.message }, { status: 500 });
    }

    // Get existing links
    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select('pluggy_account_id')
      .eq('user_id', user.id);

    if (linksError) {
      console.error('Error fetching links:', linksError);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    const linkedPluggyIds = new Set((links || []).map(l => l.pluggy_account_id));

    // Filter out already linked accounts
    const unlinkedAccounts = (pluggyAccounts || [])
      .filter((acc: any) => !linkedPluggyIds.has(acc.id))
      .map((acc: any) => ({
        id: acc.id,
        pluggy_account_id: acc.pluggy_account_id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        balance_cents: acc.balance_cents,
        currency: acc.currency,
        number: acc.number,
        institution_name: acc.pluggy_items?.connector_name || 'Open Finance',
        institution_logo: acc.institution_logo || null,
        status: acc.pluggy_items?.status,
      }));

    // Get internal accounts that can be linked
    const { data: internalAccounts, error: internalError } = await supabase
      .from('accounts')
      .select('id, name, type, current_balance, currency, institution')
      .eq('user_id', user.id);

    if (internalError) {
      console.error('Error fetching internal accounts:', internalError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    // Get already linked internal account IDs
    const { data: internalLinks } = await supabase
      .from('account_links')
      .select('internal_account_id')
      .eq('user_id', user.id);

    const linkedInternalIds = new Set((internalLinks || []).map(l => l.internal_account_id));

    // Filter out already linked internal accounts
    let availableInternalAccounts = (internalAccounts || [])
      .filter((acc: any) => !linkedInternalIds.has(acc.id));

    // For credit cards, calculate balance as sum of unpaid bills (open/closed)
    const creditCardIds = availableInternalAccounts
      .filter((acc: any) => acc.type === 'credit_card')
      .map((acc: any) => acc.id);

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
        const cardBalances = new Map<string, number>();
        bills.forEach((bill: any) => {
          const unpaid = (bill.total_cents || 0) - (bill.paid_cents || 0);
          const current = cardBalances.get(bill.account_id) || 0;
          cardBalances.set(bill.account_id, current + unpaid);
        });

        // Update credit card balances
        availableInternalAccounts = availableInternalAccounts.map((acc: any) => {
          if (acc.type === 'credit_card') {
            const unpaidBalanceCents = cardBalances.get(acc.id) || 0;
            // Convert to reais for consistency with current_balance format
            return {
              ...acc,
              current_balance: unpaidBalanceCents / 100,
            };
          }
          return acc;
        });
      }
    }

    return NextResponse.json({
      pluggy_accounts: unlinkedAccounts,
      internal_accounts: availableInternalAccounts,
    });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/unlinked-accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
