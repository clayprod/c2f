import Groq from 'groq-sdk';
import { getGlobalSettings } from '@/services/admin/globalSettings';

let groqClient: Groq | null = null;
let currentApiKey: string | null = null;

export async function getGroqClient(forceRefresh = false): Promise<Groq> {
  // Get API key from global settings (database) with fallback to env
  const settings = await getGlobalSettings();
  const apiKey = settings.groq_api_key || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set in database or environment variables');
  }

  // Recreate client if API key changed or forced refresh
  if (!groqClient || currentApiKey !== apiKey || forceRefresh) {
    groqClient = new Groq({ apiKey });
    currentApiKey = apiKey;
  }

  return groqClient;
}





