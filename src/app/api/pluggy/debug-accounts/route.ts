import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pluggyClient } from '@/services/pluggy/client';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to see raw Pluggy API response for accounts
 * This helps identify if the connector info is available
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all Pluggy items
    const { data: items, error: itemsError } = await supabase
      .from('pluggy_items')
      .select('item_id, connector_id, connector_name')
      .eq('user_id', user.id);

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch items', details: itemsError }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No Pluggy items found' });
    }

    // For each item, get raw accounts from Pluggy API
    const results = [];
    for (const item of items) {
      try {
        // Fetch raw accounts from Pluggy API
        const response = await pluggyClient.get<{ results: any[] }>(`/accounts?itemId=${item.item_id}`);
        
        results.push({
          item_id: item.item_id,
          item_connector_id: item.connector_id,
          item_connector_name: item.connector_name,
          accounts: (response.results || []).map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            // These are the fields we're interested in for the real institution
            connector: acc.connector,
            bankData: acc.bankData,
            // Check if there's institution info
            institution: acc.institution,
            institutionId: acc.institutionId,
            // Full raw response for debugging
            _raw: acc,
          })),
        });
      } catch (error: any) {
        results.push({
          item_id: item.item_id,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: 'Raw Pluggy API response for accounts',
      note: 'Look for connector.id or connector.imageUrl in each account - this should have the real institution ID (e.g., 212 for Nubank)',
      results,
    });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/debug-accounts:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}







