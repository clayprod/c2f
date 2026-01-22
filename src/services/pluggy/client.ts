import { getGlobalSettings } from '@/services/admin/globalSettings';

interface PluggyConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

let cachedConfig: PluggyConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get Pluggy configuration from GlobalSettings with fallback to env vars
 */
export async function getPluggyConfig(): Promise<PluggyConfig> {
  // Check cache
  if (cachedConfig && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const settings = await getGlobalSettings();
    
    const config: PluggyConfig = {
      clientId: settings.pluggy_client_id || process.env.PLUGGY_CLIENT_ID || '',
      clientSecret: settings.pluggy_client_secret || process.env.PLUGGY_CLIENT_SECRET || '',
      baseUrl: process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai',
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Pluggy credentials not configured');
    }

    cachedConfig = config;
    configCacheTime = Date.now();

    return config;
  } catch (error: any) {
    // Fallback to env vars only
    const config: PluggyConfig = {
      clientId: process.env.PLUGGY_CLIENT_ID || '',
      clientSecret: process.env.PLUGGY_CLIENT_SECRET || '',
      baseUrl: process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai',
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Pluggy credentials not configured');
    }

    return config;
  }
}

/**
 * Check if Pluggy integration is enabled
 */
export async function isPluggyEnabled(): Promise<boolean> {
  try {
    const settings = await getGlobalSettings();
    return settings.pluggy_enabled || false;
  } catch {
    return false;
  }
}

/**
 * Clear the config cache (call after settings update)
 */
export function clearPluggyConfigCache(): void {
  cachedConfig = null;
  configCacheTime = 0;
  accessToken = null;
  tokenExpiresAt = 0;
}

async function getAccessToken(): Promise<string> {
  // Check if token is still valid (with 5 minute buffer)
  if (accessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return accessToken;
  }

  const cfg = await getPluggyConfig();
  const response = await fetch(`${cfg.baseUrl}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Pluggy access token: ${response.statusText}`);
  }

  const data = await response.json();
  accessToken = data.apiKey;
  tokenExpiresAt = Date.now() + (data.expiresIn * 1000);

  if (!accessToken) {
    throw new Error('Failed to get access token from Pluggy');
  }
  return accessToken;
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: any,
  retries = 3
): Promise<T> {
  const token = await getAccessToken();
  const cfg = await getPluggyConfig();
  const url = `${cfg.baseUrl}${endpoint}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': token,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Pluggy API error: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (attempt === retries - 1) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error('Request failed after retries');
}

export const pluggyClient = {
  async get<T>(endpoint: string): Promise<T> {
    return request<T>('GET', endpoint);
  },

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return request<T>('POST', endpoint, body);
  },

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return request<T>('PUT', endpoint, body);
  },

  async delete<T>(endpoint: string): Promise<T> {
    return request<T>('DELETE', endpoint);
  },
};
