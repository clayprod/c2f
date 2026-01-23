import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstitutionLogoUrl } from '@/services/pluggy/bankMapping';
import { pluggyClient } from '@/services/pluggy/client';

/**
 * Get Pluggy items with institution logos
 * Returns a map of item_id -> institution_logo
 * Uses the first account's logo from each item to determine the institution
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
      console.error('Error fetching Pluggy items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ logos: {} });
    }

    // Create a map of item_id -> logo
    const itemLogoMap: Record<string, string | null> = {};

    // For each item, ALWAYS fetch from Pluggy API to get fresh logo based on account name
    // This ignores any cached/saved logos that may be incorrect
    for (const item of items) {
      try {
        // Fetch from Pluggy API to get the real account name
        const response = await pluggyClient.get<{ results: any[] }>(`/accounts?itemId=${item.item_id}`);
        
        if (response.results && response.results.length > 0) {
          // Use the first account to determine the logo
          const firstAccount = response.results[0];
          const transferNumber = firstAccount.bankData?.transferNumber;
          
          console.log(`[Items Logos] Processing item ${item.item_id}: account="${firstAccount.name}", transferNumber="${transferNumber}"`);
          
          const logoUrl = getInstitutionLogoUrl(firstAccount.name, transferNumber);

          itemLogoMap[item.item_id] = logoUrl;
          console.log(`[Items Logos] Calculated logo for item ${item.item_id} (${firstAccount.name}): ${logoUrl}`);

          // Update all accounts for this item with the correct logo
          const { error: updateError } = await supabase
            .from('pluggy_accounts')
            .update({ institution_logo: logoUrl })
            .eq('item_id', item.item_id)
            .eq('user_id', user.id);
          
          if (updateError) {
            console.error(`[Items Logos] Error updating logos for item ${item.item_id}:`, updateError);
          } else {
            console.log(`[Items Logos] Updated logos in database for item ${item.item_id}`);
          }
        } else {
          console.log(`[Items Logos] No accounts found for item ${item.item_id}`);
          itemLogoMap[item.item_id] = '/assets/connector-icons/1.svg'; // Fallback
        }
      } catch (error) {
        console.error(`[Items Logos] Error processing item ${item.item_id}:`, error);
        itemLogoMap[item.item_id] = '/assets/connector-icons/1.svg'; // Fallback
      }
    }

    console.log(`[Items Logos] Found ${Object.keys(itemLogoMap).length} items with logos`);
    return NextResponse.json({ logos: itemLogoMap });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/items-logos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

