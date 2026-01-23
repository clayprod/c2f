import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug endpoint to check logo status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all Pluggy items with connector_id
    const { data: items, error: itemsError } = await supabase
      .from('pluggy_items')
      .select('*')
      .eq('user_id', user.id);

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch items', details: itemsError }, { status: 500 });
    }

    // Get all Pluggy accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('pluggy_accounts')
      .select('*')
      .eq('user_id', user.id);

    if (accountsError) {
      return NextResponse.json({ error: 'Failed to fetch accounts', details: accountsError }, { status: 500 });
    }

    // Get all account links
    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select('*')
      .eq('user_id', user.id);

    if (linksError) {
      return NextResponse.json({ error: 'Failed to fetch links', details: linksError }, { status: 500 });
    }

    // Build response with debug info
    const debugInfo = {
      summary: {
        total_items: items?.length || 0,
        total_accounts: accounts?.length || 0,
        total_links: links?.length || 0,
      },
      items: items?.map(item => ({
        item_id: item.item_id,
        connector_id: item.connector_id,
        connector_name: item.connector_name,
        status: item.status,
        expected_logo_url: item.connector_id 
          ? `https://cdn.pluggy.ai/assets/connector-icons/${item.connector_id}.svg`
          : null,
      })) || [],
      accounts: accounts?.map(acc => ({
        id: acc.id,
        name: acc.name,
        item_id: acc.item_id,
        institution_logo: acc.institution_logo,
        // Find the connector_id for this account's item
        connector_id_from_item: items?.find(i => i.item_id === acc.item_id)?.connector_id || 'NOT FOUND',
      })) || [],
      links: links?.map(link => {
        const pluggyAccount = accounts?.find(a => a.id === link.pluggy_account_id);
        const item = items?.find(i => i.item_id === pluggyAccount?.item_id);
        return {
          internal_account_id: link.internal_account_id,
          pluggy_account_id: link.pluggy_account_id,
          pluggy_account_name: pluggyAccount?.name,
          pluggy_account_item_id: pluggyAccount?.item_id,
          current_logo: pluggyAccount?.institution_logo,
          item_connector_id: item?.connector_id || 'NOT FOUND',
          item_connector_name: item?.connector_name || 'NOT FOUND',
          correct_logo_url: item?.connector_id 
            ? `https://cdn.pluggy.ai/assets/connector-icons/${item.connector_id}.svg`
            : null,
        };
      }) || [],
    };

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/debug-logos:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

