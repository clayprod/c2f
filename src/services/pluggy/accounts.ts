import { pluggyClient } from './client';

export interface PluggyAccount {
  id: string;
  type: string;
  subtype: string;
  name: string;
  balance: {
    available: number;
    current: number;
  };
  currencyCode: string;
  number: string;
}

export async function getAccountsByItem(itemId: string): Promise<PluggyAccount[]> {
  const response = await pluggyClient.get<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`);
  return response.results || [];
}


