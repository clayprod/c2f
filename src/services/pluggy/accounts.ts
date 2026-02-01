import { buildBrandfetchLogoProxyUrl } from '@/lib/brandfetch';
import { pluggyClient } from './client';

export interface PluggyAccount {
  id: string;
  type: string;
  subtype: string;
  name: string;
  // Balance can be a number (new API format) or object (legacy format)
  balance: number | { available?: number; current?: number };
  currencyCode: string;
  number: string;
  // Bank data contains the real institution info (important when using MeuPluggy aggregator)
  bankData?: {
    transferNumber?: string;
    closingBalance?: number;
    automaticallyInvestedBalance?: number;
  };
  // Connector info for the real institution (not the aggregator)
  connector?: {
    id: number;
    name: string;
    institutionUrl?: string;
    imageUrl?: string;
    primaryColor?: string;
  };
}

/**
 * Extract balance value from Pluggy account balance field
 * Handles both number format and object format for backwards compatibility
 */
export function getAccountBalance(balance: PluggyAccount['balance']): number {
  if (typeof balance === 'number') {
    return balance;
  }
  if (balance && typeof balance === 'object') {
    return balance.current ?? balance.available ?? 0;
  }
  return 0;
}

/**
 * Get the institution logo URL from account connector
 * This is important when using MeuPluggy aggregator, as the item connector is always 200,
 * but the account connector contains the real institution info
 */
function normalizeDomainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isMeuPluggyConnector(connector?: PluggyAccount['connector']): boolean {
  const name = connector?.name?.toLowerCase() || '';
  const url = connector?.institutionUrl?.toLowerCase() || '';
  return name.includes('meupluggy') || url.includes('meupluggy');
}

export function getAccountLogoUrl(account: PluggyAccount): string | null {
  const connector = account.connector;
  const domain = normalizeDomainFromUrl(connector?.institutionUrl);

  if (domain && !isMeuPluggyConnector(connector)) {
    return buildBrandfetchLogoProxyUrl({
      identifier: `domain/${domain}`,
      size: 64,
      theme: 'dark',
      type: 'icon',
    });
  }

  // Fallback to imageUrl directly from connector (may be CDN URL)
  if (connector?.imageUrl) {
    if (connector.imageUrl.includes('cdn.pluggy.ai') && connector.id) {
      return `/assets/connector-icons/${connector.id}.svg`;
    }
    return connector.imageUrl;
  }

  // Then try to build from connector id (use local assets)
  if (connector?.id) {
    return `/assets/connector-icons/${connector.id}.svg`;
  }

  return null;
}

export async function getAccountsByItem(itemId: string): Promise<PluggyAccount[]> {
  const response = await pluggyClient.get<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`);
  console.log('[Pluggy Accounts] Raw response for item', itemId, ':', JSON.stringify(response.results?.[0], null, 2));
  return response.results || [];
}

export async function getAccountById(accountId: string): Promise<PluggyAccount | null> {
  try {
    const response = await pluggyClient.get<PluggyAccount>(`/accounts/${accountId}`);
    console.log('[Pluggy Accounts] Account details:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('[Pluggy Accounts] Error fetching account:', error);
    return null;
  }
}






