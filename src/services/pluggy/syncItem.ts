import { createClient } from '@/lib/supabase/server';
import { getAccountsByItem, getAccountBalance, getAccountLogoUrl } from './accounts';
import { getAllTransactionsByAccount } from './transactions';
import { generateTransactionHash, transactionExists } from './dedupe';
import { getItem } from './items';

/**
 * Build institution logo URL from Pluggy connector ID
 * Uses local assets: /assets/connector-icons/{connector_id}.svg
 * @deprecated Use getInstitutionLogoUrl from bankMapping instead
 */
function buildInstitutionLogoUrl(connectorId: string | number | null | undefined): string | null {
  if (!connectorId) {
    return null;
  }
  return `/assets/connector-icons/${connectorId}.svg`;
}

export interface SyncResult {
  success: boolean;
  accountsSynced: number;
  transactionsSynced: number;
  error?: string;
}

export async function syncItem(
  userId: string,
  itemId: string,
  options?: { supabase?: any }
): Promise<SyncResult> {
  const supabase = options?.supabase ?? await createClient();
  const startedAt = new Date().toISOString();

  try {
    // Get item details from Pluggy API
    const item = await getItem(itemId);

    // Try to get connector_id from API response first
    let connectorId = item.connector?.id || item.connectorId;
    
    // If not found in API response, try to get from database
    if (!connectorId) {
      const { data: dbItem } = await supabase
        .from('pluggy_items')
        .select('connector_id')
        .eq('item_id', itemId)
        .eq('user_id', userId)
        .single();
      
      if (dbItem?.connector_id) {
        connectorId = dbItem.connector_id;
      }
    }

    const institutionLogoUrl = buildInstitutionLogoUrl(connectorId);
    console.log(`[Pluggy Sync] Item ${itemId}: connector_id=${connectorId}, logo_url=${institutionLogoUrl}`);

    // Create sync log
    const { data: syncLog } = await supabase
      .from('pluggy_sync_logs')
      .insert({
        user_id: userId,
        item_id: itemId,
        started_at: startedAt,
        status: 'success',
      })
      .select()
      .single();

    // Sync accounts
    const pluggyAccounts = await getAccountsByItem(itemId);
    let accountsSynced = 0;
    let transactionsSynced = 0;

    for (const pluggyAccount of pluggyAccounts) {
      // Upsert account - balance can be number or object depending on API version
      const balanceValue = getAccountBalance(pluggyAccount.balance);
      console.log(`[Pluggy Sync] Account ${pluggyAccount.name}: raw balance =`, pluggyAccount.balance, 'extracted =', balanceValue);
      
      // Get logo from account's connector (real institution) instead of item's connector (may be aggregator like MeuPluggy)
      // This is important when using MeuPluggy where item connector is always 200
      let accountLogoUrl = getAccountLogoUrl(pluggyAccount);
      
      // Fallback to item's connector logo if account doesn't have connector info
      if (!accountLogoUrl) {
        accountLogoUrl = institutionLogoUrl;
      }
      
      console.log(`[Pluggy Sync] Account ${pluggyAccount.name}: connector =`, pluggyAccount.connector, 'logo =', accountLogoUrl);
      
      const { data: account, error: accountError } = await supabase
        .from('pluggy_accounts')
        .upsert({
          user_id: userId,
          pluggy_account_id: pluggyAccount.id,
          item_id: itemId,
          name: pluggyAccount.name,
          type: pluggyAccount.type,
          subtype: pluggyAccount.subtype,
          balance_cents: Math.round(balanceValue * 100),
          currency: pluggyAccount.currencyCode || 'BRL',
          number: pluggyAccount.number || '',
          institution_logo: accountLogoUrl,
        }, {
          onConflict: 'user_id,pluggy_account_id',
        })
        .select()
        .single();

      if (accountError) {
        console.error('Error syncing account:', accountError);
        continue;
      }

      accountsSynced++;

      // Sync transactions for this account
      const pluggyTransactions = await getAllTransactionsByAccount(pluggyAccount.id);

      for (const pluggyTx of pluggyTransactions) {
        const hash = generateTransactionHash(
          pluggyTx.date,
          Math.round(pluggyTx.amount * 100),
          pluggyTx.description
        );

        // Check if transaction already exists
        const exists = await transactionExists(
          supabase as any,
          userId,
          pluggyTx.id,
          hash
        );

        if (exists) {
          continue; // Skip duplicate
        }

        // Insert transaction
        const { error: txError } = await supabase
          .from('pluggy_transactions')
          .insert({
            user_id: userId,
            pluggy_transaction_id: pluggyTx.id,
            account_id: account.id,
            item_id: itemId,
            date: pluggyTx.date,
            description: pluggyTx.description,
            amount_cents: Math.round(Math.abs(pluggyTx.amount) * 100),
            currency: pluggyTx.currencyCode || 'BRL',
            type: pluggyTx.type === 'CREDIT' ? 'credit' : 'debit',
            category: pluggyTx.category?.name,
            subcategory: pluggyTx.subcategory?.name,
            hash,
          });

        if (txError) {
          console.error('Error syncing transaction:', txError);
          continue;
        }

        transactionsSynced++;
      }
    }

    // Update sync log
    await supabase
      .from('pluggy_sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        accounts_synced: accountsSynced,
        transactions_synced: transactionsSynced,
      })
      .eq('id', syncLog.id);

    return {
      success: true,
      accountsSynced,
      transactionsSynced,
    };
  } catch (error: any) {
    // Update sync log with error
    await supabase
      .from('pluggy_sync_logs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: error.message,
      })
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('started_at', startedAt);

    return {
      success: false,
      accountsSynced: 0,
      transactionsSynced: 0,
      error: error.message,
    };
  }
}

