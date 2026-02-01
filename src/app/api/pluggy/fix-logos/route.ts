import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pluggyClient } from '@/services/pluggy/client';
import { getAccountLogoUrl } from '@/services/pluggy/accounts';
import { getInstitutionLogoUrl, extractBankCode, getConnectorIdFromBankCode, getConnectorIdFromName } from '@/services/pluggy/bankMapping';

/**
 * Fix logos for existing accounts by using bank code mapping
 * MeuPluggy/Open Finance doesn't return connector info per account,
 * so we use the bank code from transferNumber to identify the institution
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all Pluggy items
    const { data: items, error: itemsError } = await supabase
      .from('pluggy_items')
      .select('item_id')
      .eq('user_id', user.id);

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch items', details: itemsError }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No Pluggy items found', updated: 0 });
    }

    let updated = 0;
    const updates: any[] = [];

    // For each item, get accounts from Pluggy API and update logos
    for (const item of items) {
      try {
        // Fetch raw accounts from Pluggy API
        const response = await pluggyClient.get<{ results: any[] }>(`/accounts?itemId=${item.item_id}`);
        
        for (const apiAccount of (response.results || [])) {
          // Get transferNumber from bankData (contains bank code)
          const transferNumber = apiAccount.bankData?.transferNumber;
          const bankCode = extractBankCode(transferNumber);
          
          // Try Brandfetch via connector institutionUrl (skips MeuPluggy), then fallback to mapping
          let logoUrl = getAccountLogoUrl(apiAccount) || getInstitutionLogoUrl(apiAccount.name, transferNumber);
          
          const connectorIdFromBank = getConnectorIdFromBankCode(bankCode);
          const connectorIdFromName = getConnectorIdFromName(apiAccount.name);
          
          if (logoUrl) {
            // Update the account in our database
            const { error: updateError } = await supabase
              .from('pluggy_accounts')
              .update({ institution_logo: logoUrl })
              .eq('user_id', user.id)
              .eq('pluggy_account_id', apiAccount.id);
            
            if (updateError) {
              console.error(`[Fix Logos] Error updating account ${apiAccount.id}:`, updateError);
              updates.push({
                account_id: apiAccount.id,
                name: apiAccount.name,
                error: updateError.message,
              });
            } else {
              updated++;
              updates.push({
                account_id: apiAccount.id,
                name: apiAccount.name,
                transfer_number: transferNumber,
                bank_code: bankCode,
                connector_id_from_bank: connectorIdFromBank,
                connector_id_from_name: connectorIdFromName,
                logo_url: logoUrl,
                status: 'updated',
              });
            }
          } else {
            console.log(`[Fix Logos] Could not determine institution for account ${apiAccount.name} (${apiAccount.id})`);
            updates.push({
              account_id: apiAccount.id,
              name: apiAccount.name,
              transfer_number: transferNumber,
              bank_code: bankCode,
              connector_id_from_bank: connectorIdFromBank,
              connector_id_from_name: connectorIdFromName,
              status: 'no_logo_found',
            });
          }
        }
      } catch (error: any) {
        console.error(`[Fix Logos] Error processing item ${item.item_id}:`, error);
      }
    }

    return NextResponse.json({
      message: `Updated ${updated} accounts with correct logos`,
      updated,
      details: updates,
    });
  } catch (error: any) {
    console.error('Error in POST /api/pluggy/fix-logos:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

