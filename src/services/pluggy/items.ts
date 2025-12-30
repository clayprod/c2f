import { pluggyClient } from './client';

export interface PluggyItem {
  id: string;
  connector?: {
    id: number;
    name: string;
  };
  connectorId?: number;
  connectorName?: string;
  status: string;
  error?: {
    code: string;
    message: string;
  };
  executionStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConnectTokenResponse {
  connectToken: string;
}

export async function createConnectToken(): Promise<string> {
  const response = await pluggyClient.post<ConnectTokenResponse>('/connect_token');
  return response.connectToken;
}

export async function getItem(itemId: string): Promise<PluggyItem> {
  return pluggyClient.get<PluggyItem>(`/items/${itemId}`);
}

export async function listItems(): Promise<PluggyItem[]> {
  const response = await pluggyClient.get<{ results: PluggyItem[] }>('/items');
  return response.results || [];
}

export async function deleteItem(itemId: string): Promise<void> {
  await pluggyClient.delete(`/items/${itemId}`);
}

