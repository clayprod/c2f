import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Transform data for easier consumption
    const transformedLinks = (links || []).map((link: any) => ({
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
        institution_logo: null,
      },
      internal_account: {
        id: link.accounts.id,
        name: link.accounts.name,
        type: link.accounts.type,
        current_balance: link.accounts.current_balance,
        currency: link.accounts.currency,
        institution: link.accounts.institution,
      },
    }));

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

    // Verify pluggy account belongs to user
    const { data: pluggyAccount, error: pluggyError } = await supabase
      .from('pluggy_accounts')
      .select('id')
      .eq('id', pluggy_account_id)
      .eq('user_id', user.id)
      .single();

    if (pluggyError || !pluggyAccount) {
      return NextResponse.json({ error: 'Pluggy account not found' }, { status: 404 });
    }

    // Verify internal account belongs to user
    const { data: internalAccount, error: internalError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', internal_account_id)
      .eq('user_id', user.id)
      .single();

    if (internalError || !internalAccount) {
      return NextResponse.json({ error: 'Internal account not found' }, { status: 404 });
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
