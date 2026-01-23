import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Update institution logos for existing Pluggy accounts
 * This endpoint can be called to backfill logos for accounts that were synced before the logo feature was added
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all Pluggy items with connector_id
    const { data: items, error: itemsError } = await supabase
      .from('pluggy_items')
      .select('item_id, connector_id')
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items', details: itemsError }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        message: 'No items found',
        updated: 0 
      });
    }

    let updated = 0;
    const itemsWithoutConnector: string[] = [];

    // For each item, update all its accounts with the logo URL
    for (const item of items) {
      if (!item.connector_id) {
        itemsWithoutConnector.push(item.item_id);
        continue;
      }

      const logoUrl = `https://cdn.pluggy.ai/assets/connector-icons/${item.connector_id}.svg`;

      // Count accounts that need updating (null or empty)
      const { count: countBefore } = await supabase
        .from('pluggy_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('item_id', item.item_id)
        .is('institution_logo', null);

      // Update accounts without logo
      const { data: updatedAccounts, error: updateError } = await supabase
        .from('pluggy_accounts')
        .update({ institution_logo: logoUrl })
        .eq('user_id', user.id)
        .eq('item_id', item.item_id)
        .is('institution_logo', null)
        .select('id');

      if (updateError) {
        console.error(`Error updating logos for item ${item.item_id}:`, updateError);
        continue;
      }

      const countUpdated = updatedAccounts?.length || 0;
      updated += countUpdated;
      console.log(`[Update Logos] Item ${item.item_id}: Updated ${countUpdated} accounts with logo ${logoUrl}`);
    }

    return NextResponse.json({ 
      message: 'Logos updated successfully',
      updated,
      items_processed: items.length,
      items_without_connector: itemsWithoutConnector.length,
      items_without_connector_ids: itemsWithoutConnector,
    });
  } catch (error: any) {
    console.error('Error in POST /api/pluggy/update-logos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

