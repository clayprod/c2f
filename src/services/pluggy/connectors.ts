import { pluggyClient } from './client';

export interface PluggyConnector {
  id: number;
  name: string;
  country: string;
  primaryColor?: string;
  institutionUrl?: string;
  imageUrl?: string;
  hasMFA?: boolean;
  products?: string[];
  type?: string;
}

export interface ConnectorsResponse {
  results: PluggyConnector[];
  page: number;
  totalPages: number;
  total: number;
}

/**
 * List all available connectors from Pluggy API
 * This can be used to get the correct connector IDs for institutions
 */
export async function listConnectors(params?: {
  country?: string;
  name?: string;
  page?: number;
  pageSize?: number;
}): Promise<ConnectorsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.country) {
    queryParams.append('country', params.country);
  }
  if (params?.name) {
    queryParams.append('name', params.name);
  }
  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.pageSize) {
    queryParams.append('pageSize', params.pageSize.toString());
  }

  const endpoint = `/connectors${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return pluggyClient.get<ConnectorsResponse>(endpoint);
}

/**
 * Get a specific connector by ID
 */
export async function getConnector(connectorId: number): Promise<PluggyConnector> {
  return pluggyClient.get<PluggyConnector>(`/connectors/${connectorId}`);
}

/**
 * Search connectors by name (case-insensitive)
 */
export async function searchConnectorsByName(searchTerm: string): Promise<PluggyConnector[]> {
  const response = await listConnectors({ name: searchTerm });
  return response.results;
}

/**
 * Get connectors for Brazil (BR)
 */
export async function getBrazilianConnectors(): Promise<PluggyConnector[]> {
  const response = await listConnectors({ country: 'BR' });
  return response.results;
}

/**
 * Build a map of connector ID -> connector name for quick lookup
 */
export async function getConnectorMap(): Promise<Record<number, string>> {
  const connectors = await getBrazilianConnectors();
  const map: Record<number, string> = {};
  
  for (const connector of connectors) {
    map[connector.id] = connector.name;
  }
  
  return map;
}


