import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstitutionLogoUrl } from '@/services/pluggy/bankMapping';
import { getAccountLogoUrl } from '@/services/pluggy/accounts';
import { pluggyClient } from '@/services/pluggy/client';

export const dynamic = 'force-dynamic';

/**
 * Get Pluggy links with institution logos for accounts
 * Returns a map of account_id -> institution_logo
 * Recalculates logos using Pluggy account connector data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all account links
    const { data: links, error: linksError } = await supabase
      .from('account_links')
      .select('internal_account_id, pluggy_account_id')
      .eq('user_id', user.id);

    if (linksError) {
      console.error('Error fetching account links:', linksError);
      return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }

    if (!links || links.length === 0) {
      console.log('[Pluggy Links] No links found');
      return NextResponse.json({ logos: {} });
    }

    // Get pluggy account IDs and their item_ids
    const pluggyAccountIds = links.map(l => l.pluggy_account_id);

    const { data: pluggyAccounts, error: accountsError } = await supabase
      .from('pluggy_accounts')
      .select('id, item_id, pluggy_account_id')
      .in('id', pluggyAccountIds)
      .eq('user_id', user.id);

    if (accountsError) {
      console.error('Error fetching Pluggy accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    // Get unique item_ids
    const itemIds = [...new Set((pluggyAccounts || []).map((acc: any) => acc.item_id).filter(Boolean))];
    
    // Create map of pluggy_account_id -> logo
    const accountLogoMap: Record<string, string> = {};
    
    // Fetch accounts from Pluggy API for each item and calculate logos from names
    for (const itemId of itemIds) {
      try {
        console.log(`[Pluggy Links] Fetching accounts for item ${itemId}`);
        const response = await pluggyClient.get<{ results: any[] }>(`/accounts?itemId=${itemId}`);
        
        for (const apiAccount of (response.results || [])) {
          // Find the matching DB account
          const dbAccount = pluggyAccounts?.find((a: any) => 
            a.pluggy_account_id === apiAccount.id || a.id === apiAccount.id
          );
          
          if (!dbAccount) {
            console.log(`[Pluggy Links] No DB account found for API account ${apiAccount.id}`);
            continue;
          }
          
          const transferNumber = apiAccount.bankData?.transferNumber;
          const logoUrl =
            getAccountLogoUrl(apiAccount) ||
            getInstitutionLogoUrl(apiAccount.name, transferNumber);
          
          console.log(`[Pluggy Links] Account "${apiAccount.name}": calculated logo = ${logoUrl}`);
          
          accountLogoMap[dbAccount.id] = logoUrl;
          
          // Update in database
          const { error: updateError } = await supabase
            .from('pluggy_accounts')
            .update({ institution_logo: logoUrl })
            .eq('id', dbAccount.id);
          
          if (updateError) {
            console.error(`[Pluggy Links] Error updating logo for ${dbAccount.id}:`, updateError);
          }
        }
      } catch (error) {
        console.error(`[Pluggy Links] Error fetching accounts for item ${itemId}:`, error);
      }
    }

    // Create final map of internal_account_id -> logo
    const logoMap: Record<string, string> = {};
    links.forEach((link: any) => {
      const logo = accountLogoMap[link.pluggy_account_id];
      if (logo) {
        logoMap[link.internal_account_id] = logo;
        console.log(`[Pluggy Links] Mapped internal account ${link.internal_account_id} -> ${logo}`);
      }
    });

    console.log(`[Pluggy Links] Final logo map:`, logoMap);
    
    return NextResponse.json({ logos: logoMap });
  } catch (error: any) {
    console.error('Error in GET /api/accounts/pluggy-links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
