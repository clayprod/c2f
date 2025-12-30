interface PluggyConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

let config: PluggyConfig | null = null;
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

export function getPluggyConfig(): PluggyConfig {
  if (!config) {
    config = {
      clientId: process.env.PLUGGY_CLIENT_ID || '',
      clientSecret: process.env.PLUGGY_CLIENT_SECRET || '',
      baseUrl: process.env.PLUGGY_BASE_URL || 'https://api.pluggy.ai',
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Pluggy credentials not configured');
    }
  }
  return config;
}

async function getAccessToken(): Promise<string> {
  // Check if token is still valid (with 5 minute buffer)
  if (accessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return accessToken;
  }

  const cfg = getPluggyConfig();
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
  const cfg = getPluggyConfig();
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

