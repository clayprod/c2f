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

export async function getAccountsByItem(itemId: string): Promise<PluggyAccount[]> {
  const response = await pluggyClient.get<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`);
  return response.results || [];
}






