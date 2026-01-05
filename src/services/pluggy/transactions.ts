import { pluggyClient } from './client';

export interface PluggyTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  currencyCode: string;
  type: 'CREDIT' | 'DEBIT';
  category?: {
    id: string;
    name: string;
  };
  subcategory?: {
    id: string;
    name: string;
  };
}

export interface TransactionsResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: PluggyTransaction[];
}

export async function getTransactionsByAccount(
  accountId: string,
  from?: string,
  to?: string,
  page = 1
): Promise<TransactionsResponse> {
  const params = new URLSearchParams({
    accountId,
    page: page.toString(),
  });
  
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  return pluggyClient.get<TransactionsResponse>(`/transactions?${params.toString()}`);
}

export async function getAllTransactionsByAccount(
  accountId: string,
  from?: string,
  to?: string
): Promise<PluggyTransaction[]> {
  const allTransactions: PluggyTransaction[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await getTransactionsByAccount(accountId, from, to, page);
    allTransactions.push(...response.results);
    
    hasMore = page < response.totalPages;
    page++;
  }

  return allTransactions;
}





