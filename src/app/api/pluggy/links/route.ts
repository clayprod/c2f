import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pluggyClient } from '@/services/pluggy/client';
import { getAccountLogoUrl } from '@/services/pluggy/accounts';
import { getInstitutionLogoUrl } from '@/services/pluggy/bankMapping';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all account links with related data
    const { data: links, error } = await supabase
      .from('account_links')
      .select(`
        id,
        linked_at,
        pluggy_account_id,
        internal_account_id,
        pluggy_accounts!inner (
          id,
          name,
          type,
          subtype,
          balance_cents,
          currency,
          number,
          pluggy_account_id,
          item_id,
          institution_logo,
          pluggy_items!inner (
            connector_name,
            connector_id
          )
        ),
        accounts!inner (
          id,
          name,
          type,
          current_balance,
          currency,
          institution
        )
      `)
      .eq('user_id', user.id)
      .order('linked_at', { ascending: false });

    if (error) {
      console.error('Error fetching account links:', error);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    // Refresh logos using Pluggy API (Brandfetch when available)
    const linkAccounts = links || [];
    const accountByExternalId = new Map(
      linkAccounts.map((link: any) => [link.pluggy_accounts.pluggy_account_id, link.pluggy_accounts])
    );
    const logoByAccountId = new Map<string, string>();
    const itemIds = [
      ...new Set(linkAccounts.map((link: any) => link.pluggy_accounts.item_id).filter(Boolean)),
    ];

    for (const itemId of itemIds) {
      try {
        const response = await pluggyClient.get<{ results: any[] }>(`/accounts?itemId=${itemId}`);
        for (const apiAccount of response.results || []) {
          const dbAccount = accountByExternalId.get(apiAccount.id);
          if (!dbAccount) continue;

          const transferNumber = apiAccount.bankData?.transferNumber;
          const logoUrl =
            getAccountLogoUrl(apiAccount) ||
            getInstitutionLogoUrl(apiAccount.name, transferNumber);

          if (!logoUrl) continue;

          logoByAccountId.set(dbAccount.id, logoUrl);

          const { error: updateError } = await supabase
            .from('pluggy_accounts')
            .update({ institution_logo: logoUrl })
            .eq('id', dbAccount.id);

          if (updateError) {
            console.error('[Pluggy Links] Error updating logo:', updateError);
          }
        }
      } catch (err) {
        console.error(`[Pluggy Links] Error fetching accounts for item ${itemId}:`, err);
      }
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
        .in('status', ['open', 'closed', 'partial', 'overdue']);

      if (!billsError && bills) {
        // Calculate total unpaid amount per card
        bills.forEach((bill: any) => {
          const unpaid = (bill.total_cents || 0) - (bill.paid_cents || 0);
          const current = cardBalances.get(bill.account_id) || 0;
          cardBalances.set(bill.account_id, current + unpaid);
        });
      }
    }

    // Transform data for easier consumption
    const transformedLinks = (links || []).map((link: any) => {
      // For credit cards, use calculated unpaid balance instead of current_balance
      let balance = link.accounts.current_balance || 0;
      if (link.accounts.type === 'credit_card') {
        const unpaidBalanceCents = cardBalances.get(link.accounts.id) || 0;
        balance = unpaidBalanceCents / 100; // Convert to reais
      }

      return {
        id: link.id,
        linked_at: link.linked_at,
        pluggy_account: {
          id: link.pluggy_accounts.id,
          pluggy_account_id: link.pluggy_accounts.pluggy_account_id,
          name: link.pluggy_accounts.name,
          type: link.pluggy_accounts.type,
          subtype: link.pluggy_accounts.subtype,
          balance_cents: link.pluggy_accounts.balance_cents,
          currency: link.pluggy_accounts.currency,
          number: link.pluggy_accounts.number,
          institution_name: link.pluggy_accounts.pluggy_items?.connector_name || 'Open Finance',
          institution_logo: logoByAccountId.get(link.pluggy_accounts.id) || link.pluggy_accounts.institution_logo || null,
        },
        internal_account: {
          id: link.accounts.id,
          name: link.accounts.name,
          type: link.accounts.type,
          current_balance: balance,
          currency: link.accounts.currency,
          institution: link.accounts.institution,
        },
      };
    });

    return NextResponse.json({ data: transformedLinks });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pluggy_account_id, internal_account_id } = body;

    if (!pluggy_account_id || !internal_account_id) {
      return NextResponse.json(
        { error: 'pluggy_account_id and internal_account_id are required' },
        { status: 400 }
      );
    }

    // Verify internal account belongs to user
    const { data: internalAccount, error: internalError } = await supabase
      .from('accounts')
      .select('id, type')
      .eq('id', internal_account_id)
      .eq('user_id', user.id)
      .single();

    if (internalError || !internalAccount) {
      return NextResponse.json({ error: 'Internal account not found' }, { status: 404 });
    }

    const internalIsCreditCard = internalAccount.type === 'credit_card' || internalAccount.type === 'credit';

    // Also verify Pluggy account
    const { data: pluggyAccountData, error: pluggyTypeError } = await supabase
      .from('pluggy_accounts')
      .select('id, type, subtype')
      .eq('id', pluggy_account_id)
      .eq('user_id', user.id)
      .single();

    if (pluggyTypeError || !pluggyAccountData) {
      return NextResponse.json({ error: 'Pluggy account not found' }, { status: 404 });
    }

    const pluggyIsCreditCard =
      pluggyAccountData.type === 'CREDIT' || pluggyAccountData.subtype === 'credit_card';

    if (internalIsCreditCard !== pluggyIsCreditCard) {
      return NextResponse.json(
        {
          error:
            'Tipo incompatível: vincule cartão de crédito apenas com cartão de crédito, e conta bancária apenas com conta bancária.',
        },
        { status: 400 }
      );
    }

    // Create the link
    const { data: link, error: linkError } = await supabase
      .from('account_links')
      .insert({
        user_id: user.id,
        pluggy_account_id,
        internal_account_id,
      })
      .select()
      .single();

    if (linkError) {
      if (linkError.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Esta conta ja esta vinculada' },
          { status: 409 }
        );
      }
      console.error('Error creating link:', linkError);
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }

    return NextResponse.json({ data: link }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/pluggy/links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('id');

    if (!linkId) {
      return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('account_links')
      .delete()
      .eq('id', linkId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting link:', error);
      return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/pluggy/links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
