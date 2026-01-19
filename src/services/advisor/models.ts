/**
 * Dynamic Model Fetching Service
 * Fetches available models from Groq and OpenAI APIs
 */

import Groq from 'groq-sdk';
import OpenAI from 'openai';

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  isChat?: boolean;
}

// Cache for models (refresh every 1 hour)
let groqModelsCache: ModelInfo[] | null = null;
let openaiModelsCache: ModelInfo[] | null = null;
let groqCacheTime = 0;
let openaiCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Fallback models in case API fails
const FALLBACK_GROQ_MODELS: ModelInfo[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
];

const FALLBACK_OPENAI_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
];

/**
 * Fetch available models from Groq API
 */
export async function fetchGroqModels(apiKey?: string): Promise<ModelInfo[]> {
  const now = Date.now();

  // Return cache if valid
  if (groqModelsCache && (now - groqCacheTime) < CACHE_TTL) {
    return groqModelsCache;
  }

  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('No Groq API key available, using fallback models');
    return FALLBACK_GROQ_MODELS;
  }

  try {
    const client = new Groq({ apiKey: key });
    const response = await client.models.list();

    if (!response.data || response.data.length === 0) {
      return FALLBACK_GROQ_MODELS;
    }

    // Filter and format models (only chat models)
    const models: ModelInfo[] = response.data
      .filter((model: any) => {
        // Filter for chat/text generation models
        const id = model.id.toLowerCase();
        return !id.includes('whisper') &&
               !id.includes('distil') &&
               !id.includes('tool-use') &&
               model.active !== false;
      })
      .map((model: any) => ({
        id: model.id,
        name: formatModelName(model.id),
        contextWindow: model.context_window,
        isChat: true,
      }))
      .sort((a: ModelInfo, b: ModelInfo) => {
        // Sort by name, prioritizing larger models
        if (a.id.includes('70b') && !b.id.includes('70b')) return -1;
        if (!a.id.includes('70b') && b.id.includes('70b')) return 1;
        return a.name.localeCompare(b.name);
      });

    if (models.length > 0) {
      groqModelsCache = models;
      groqCacheTime = now;
      return models;
    }

    return FALLBACK_GROQ_MODELS;
  } catch (error) {
    console.error('Error fetching Groq models:', error);
    return FALLBACK_GROQ_MODELS;
  }
}

/**
 * Fetch available models from OpenAI API
 */
export async function fetchOpenAIModels(apiKey?: string): Promise<ModelInfo[]> {
  const now = Date.now();

  // Return cache if valid
  if (openaiModelsCache && (now - openaiCacheTime) < CACHE_TTL) {
    return openaiModelsCache;
  }

  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn('No OpenAI API key available, using fallback models');
    return FALLBACK_OPENAI_MODELS;
  }

  try {
    const client = new OpenAI({ apiKey: key });
    const response = await client.models.list();

    // Filter and format models (only GPT chat models)
    const models: ModelInfo[] = response.data
      .filter((model: any) => {
        const id = model.id.toLowerCase();
        return (id.startsWith('gpt-4') || id.startsWith('gpt-3.5')) &&
               !id.includes('instruct') &&
               !id.includes('vision') &&
               !id.includes('realtime') &&
               !id.includes('audio');
      })
      .map((model: any) => ({
        id: model.id,
        name: formatOpenAIModelName(model.id),
        isChat: true,
      }))
      .sort((a: ModelInfo, b: ModelInfo) => {
        // Sort: gpt-4o first, then gpt-4, then gpt-3.5
        const aScore = getOpenAIModelScore(a.id);
        const bScore = getOpenAIModelScore(b.id);
        return bScore - aScore;
      })
      // Remove duplicates (keep first occurrence)
      .filter((model: ModelInfo, index: number, self: ModelInfo[]) =>
        index === self.findIndex(m => m.id === model.id)
      );

    if (models.length > 0) {
      openaiModelsCache = models;
      openaiCacheTime = now;
      return models;
    }

    return FALLBACK_OPENAI_MODELS;
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    return FALLBACK_OPENAI_MODELS;
  }
}

/**
 * Get models for a specific provider
 */
export async function getModelsForProvider(
  provider: 'groq' | 'openai',
  apiKey?: string
): Promise<ModelInfo[]> {
  if (provider === 'groq') {
    return fetchGroqModels(apiKey);
  }
  return fetchOpenAIModels(apiKey);
}

/**
 * Clear models cache (useful after API key changes)
 */
export function clearModelsCache(): void {
  groqModelsCache = null;
  openaiModelsCache = null;
  groqCacheTime = 0;
  openaiCacheTime = 0;
}

/**
 * Format Groq model name for display
 */
function formatModelName(modelId: string): string {
  const parts = modelId.split('-');

  // Handle llama models
  if (modelId.includes('llama')) {
    const version = parts.find(p => /^\d+(\.\d+)?$/.test(p)) || '';
    const size = parts.find(p => p.includes('b')) || '';
    const type = parts.find(p => ['versatile', 'instant', 'specdec'].includes(p)) || '';

    let name = 'Llama';
    if (version) name += ` ${version}`;
    if (size) name += ` ${size.toUpperCase()}`;
    if (type) name += ` (${type.charAt(0).toUpperCase() + type.slice(1)})`;
    return name;
  }

  // Handle mixtral
  if (modelId.includes('mixtral')) {
    return 'Mixtral 8x7B';
  }

  // Handle gemma
  if (modelId.includes('gemma')) {
    const size = parts.find(p => p.includes('b')) || '';
    return `Gemma ${size ? size.toUpperCase() : ''}`.trim();
  }

  // Handle qwen
  if (modelId.includes('qwen')) {
    return modelId.split('-').map(p =>
      p.charAt(0).toUpperCase() + p.slice(1)
    ).join(' ');
  }

  // Default: capitalize words
  return modelId.split('-').map(p =>
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}

/**
 * Format OpenAI model name for display
 */
function formatOpenAIModelName(modelId: string): string {
  if (modelId.includes('gpt-4o-mini')) return 'GPT-4o Mini';
  if (modelId.includes('gpt-4o')) return 'GPT-4o';
  if (modelId.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
  if (modelId.includes('gpt-4')) return 'GPT-4';
  if (modelId.includes('gpt-3.5-turbo')) return 'GPT-3.5 Turbo';
  return modelId.toUpperCase();
}

/**
 * Score OpenAI models for sorting
 */
function getOpenAIModelScore(modelId: string): number {
  if (modelId === 'gpt-4o') return 100;
  if (modelId === 'gpt-4o-mini') return 90;
  if (modelId.includes('gpt-4o')) return 85;
  if (modelId.includes('gpt-4-turbo')) return 80;
  if (modelId.includes('gpt-4')) return 70;
  if (modelId.includes('gpt-3.5')) return 50;
  return 0;
}
