/**
 * Evolution API Client
 *
 * Client for communicating with Evolution API for WhatsApp integration.
 * Based on the Pluggy client pattern.
 */

import { getGlobalSettings } from '@/services/admin/globalSettings';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: string;
  status: string;
}

export interface InstanceStatus {
  instance: {
    instanceName: string;
    state: 'open' | 'close' | 'connecting';
  };
}

export interface InstanceInfo {
  instanceName: string;
  state: string;
  profileName?: string;
  profilePictureUrl?: string;
  number?: string;
}

class EvolutionClient {
  private config: EvolutionConfig;

  constructor(config: EvolutionConfig) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EvolutionClient] API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        error: errorText,
      });
      throw new Error(`Evolution API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Send a text message to a WhatsApp number
   * @param to Phone number in format 5511999999999 (without +)
   * @param text Message text
   */
  async sendTextMessage(to: string, text: string): Promise<SendMessageResponse> {
    // Normalize phone number (remove + and any non-digits)
    const normalizedNumber = to.replace(/\D/g, '');

    return this.request<SendMessageResponse>(
      `/message/sendText/${this.config.instanceName}`,
      {
        method: 'POST',
        body: JSON.stringify({
          number: normalizedNumber,
          text,
        }),
      }
    );
  }

  /**
   * Get the status of the WhatsApp instance
   */
  async getInstanceStatus(): Promise<InstanceStatus> {
    return this.request<InstanceStatus>(
      `/instance/connectionState/${this.config.instanceName}`,
      { method: 'GET' }
    );
  }

  /**
   * Get detailed info about the WhatsApp instance
   */
  async getInstanceInfo(): Promise<InstanceInfo> {
    const response = await this.request<InstanceInfo[]>(
      `/instance/fetchInstances?instanceName=${this.config.instanceName}`,
      { method: 'GET' }
    );
    // API returns an array, get the first item
    if (Array.isArray(response) && response.length > 0) {
      return response[0];
    }
    throw new Error('Instance not found');
  }

  /**
   * List all available instances
   */
  async listInstances(): Promise<InstanceInfo[]> {
    const response = await this.request<InstanceInfo[]>(
      '/instance/fetchInstances',
      { method: 'GET' }
    );
    return response;
  }

  /**
   * Set up webhook for the instance
   * @param webhookUrl URL to receive webhook events
   * @param events Events to subscribe to
   */
  async setWebhook(
    webhookUrl: string,
    events: string[] = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
  ): Promise<void> {
    await this.request(
      `/webhook/set/${this.config.instanceName}`,
      {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events,
        }),
      }
    );
  }

  /**
   * Check if the instance is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      const status = await this.getInstanceStatus();
      return status.instance.state === 'open';
    } catch (error) {
      console.error('[EvolutionClient] Error checking connection:', error);
      return false;
    }
  }
}

// Cached client instance
let cachedClient: EvolutionClient | null = null;
let cachedConfig: EvolutionConfig | null = null;

/**
 * Get a configured Evolution API client
 * Returns null if Evolution API is not configured in global settings
 */
export async function getEvolutionClient(): Promise<EvolutionClient | null> {
  const settings = await getGlobalSettings();

  // Check if Evolution API is configured
  if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance_name) {
    console.log('[EvolutionClient] Evolution API not configured');
    return null;
  }

  // Check if WhatsApp is enabled
  if (!settings.whatsapp_enabled) {
    console.log('[EvolutionClient] WhatsApp integration is disabled');
    return null;
  }

  const config: EvolutionConfig = {
    apiUrl: settings.evolution_api_url,
    apiKey: settings.evolution_api_key,
    instanceName: settings.evolution_instance_name,
  };

  // Check if we can reuse cached client
  if (
    cachedClient &&
    cachedConfig &&
    cachedConfig.apiUrl === config.apiUrl &&
    cachedConfig.apiKey === config.apiKey &&
    cachedConfig.instanceName === config.instanceName
  ) {
    return cachedClient;
  }

  // Create new client
  cachedClient = new EvolutionClient(config);
  cachedConfig = config;

  return cachedClient;
}

/**
 * Clear the cached client (useful after settings update)
 */
export function clearEvolutionClientCache(): void {
  cachedClient = null;
  cachedConfig = null;
}

/**
 * Send a text message using the global Evolution API client
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<SendMessageResponse | null> {
  const client = await getEvolutionClient();
  if (!client) {
    throw new Error('Evolution API is not configured or WhatsApp is disabled');
  }
  return client.sendTextMessage(to, text);
}

/**
 * Get the status of the configured WhatsApp instance
 */
export async function getWhatsAppStatus(): Promise<InstanceStatus | null> {
  const client = await getEvolutionClient();
  if (!client) {
    return null;
  }
  return client.getInstanceStatus();
}

/**
 * Check if WhatsApp integration is available
 */
export async function isWhatsAppAvailable(): Promise<boolean> {
  const client = await getEvolutionClient();
  if (!client) {
    return false;
  }
  return client.isConnected();
}
