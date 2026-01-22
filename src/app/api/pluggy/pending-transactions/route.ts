import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Get pending (unimported) transactions from Pluggy
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
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!linkId) {
      return NextResponse.json({ error: 'link_id is required' }, { status: 400 });
    }

    // Get the link to find the Pluggy account ID
    const { data: link, error: linkError } = await supabase
      .from('account_links')
      .select(`
        id,
        internal_account_id,
        pluggy_accounts!inner (
          pluggy_account_id
        )
      `)
      .eq('id', linkId)
      .eq('user_id', user.id)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const pluggyAccountId = (link.pluggy_accounts as any).pluggy_account_id;

    // Get unimported transactions
    const { data: transactions, error: txError, count } = await supabase
      .from('pluggy_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('account_id', pluggyAccountId)
      .is('imported_at', null)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({
      transactions: transactions || [],
      total: count || 0,
      internal_account_id: link.internal_account_id,
    });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/pending-transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
