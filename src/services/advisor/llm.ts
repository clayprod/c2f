/**
 * LLM Orchestrator
 * Handles communication with AI providers (Groq, OpenAI)
 */

import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserPlan } from '@/services/stripe/subscription';
import { ChatMessage, LLMCallParams, LLMResponse, AdvisorResponse } from './types';
import { DEFAULT_ADVISOR_PROMPT, DEFAULT_TIPS_PROMPT } from './prompts';

// Client cache
let groqClient: Groq | null = null;
let openaiClient: OpenAI | null = null;

/**
 * Get or create Groq client
 */
async function getGroqClient(apiKey: string): Promise<Groq> {
  if (!groqClient || (groqClient as any)._apiKey !== apiKey) {
    groqClient = new Groq({ apiKey });
    (groqClient as any)._apiKey = apiKey;
  }
  return groqClient;
}

/**
 * Get or create OpenAI client
 */
async function getOpenAIClient(apiKey: string): Promise<OpenAI> {
  if (!openaiClient || (openaiClient as any)._apiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
    (openaiClient as any)._apiKey = apiKey;
  }
  return openaiClient;
}

/**
 * Call Groq API
 */
async function callGroq(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  responseFormat: 'json' | 'text' = 'json'
): Promise<string> {
  const client = await getGroqClient(apiKey);

  const completion = await client.chat.completions.create({
    model: model || 'llama-3.1-70b-versatile',
    messages: messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
    response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
    temperature: 0.7,
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  responseFormat: 'json' | 'text' = 'json'
): Promise<string> {
  const client = await getOpenAIClient(apiKey);

  const completion = await client.chat.completions.create({
    model: model || 'gpt-4o',
    messages: messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
    response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
    temperature: 0.7,
    max_tokens: 2048,
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Get API configuration (provider, model, key)
 */
export async function getAPIConfig(userId?: string): Promise<{
  provider: 'groq' | 'openai';
  model: string;
  apiKey: string;
  useGlobalKeys: boolean;
}> {
  let settings: any = {};
  try {
    settings = await getGlobalSettings();
  } catch (error) {
    console.error('[Advisor] Error fetching global settings, using defaults:', error);
  }

  // Check if user has paid plan to use global keys
  let useGlobalKeys = false;
  if (userId) {
    try {
      const plan = await getUserPlan(userId);
      useGlobalKeys = plan.plan === 'pro' || plan.plan === 'premium';
    } catch (error) {
      console.error('[Advisor] Error checking user plan:', error);
    }
  }

  const provider = (settings.ai_model as 'groq' | 'openai') || 'groq';
  const model = settings.ai_model_name ||
    (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o');

  // Determine API key - always try env vars first, then settings
  let apiKey: string = '';

  // Try environment variables first (most reliable)
  if (provider === 'groq') {
    apiKey = process.env.GROQ_API_KEY || '';
  } else {
    apiKey = process.env.OPENAI_API_KEY || '';
  }

  // If no env var, try global settings (for paid users)
  if (!apiKey && useGlobalKeys) {
    if (provider === 'groq' && settings.groq_api_key) {
      apiKey = settings.groq_api_key;
    } else if (provider === 'openai' && settings.openai_api_key) {
      apiKey = settings.openai_api_key;
    }
  }

  console.log('[Advisor] API Config:', {
    provider,
    model,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    useGlobalKeys,
    hasSettingsGroqKey: !!settings.groq_api_key,
    hasSettingsOpenaiKey: !!settings.openai_api_key,
    hasEnvGroqKey: !!process.env.GROQ_API_KEY,
    hasEnvOpenaiKey: !!process.env.OPENAI_API_KEY,
  });

  return { provider, model, apiKey, useGlobalKeys };
}

/**
 * Main function to call LLM
 */
export async function callLLM(params: LLMCallParams): Promise<LLMResponse> {
  const { messages, userId, responseFormat = 'json' } = params;
  const { provider, model, apiKey } = await getAPIConfig(userId);

  if (!apiKey) {
    console.error(`No API key available for provider: ${provider}. Please set ${provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'} environment variable.`);
    throw new Error(`Chave de API não configurada. Configure a variável ${provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY'} ou adicione nas configurações do admin.`);
  }

  try {
    let content: string;

    if (provider === 'groq') {
      content = await callGroq(messages, model, apiKey, responseFormat);
    } else {
      content = await callOpenAI(messages, model, apiKey, responseFormat);
    }

    // Try to parse as JSON if expected
    let parsed: AdvisorResponse | undefined;
    if (responseFormat === 'json' && content) {
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        console.warn('Failed to parse LLM response as JSON:', e);
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.warn('Failed to extract JSON from response:', e2);
          }
        }
      }
    }

    return {
      content,
      parsed,
      tokensUsed: estimateTokens(content),
    };
  } catch (error: any) {
    console.error('LLM call error:', error);
    // Provide more specific error messages
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error('Chave de API inválida. Verifique a configuração.');
    }
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
    }
    if (error.message?.includes('500') || error.message?.includes('503')) {
      throw new Error('Serviço de IA temporariamente indisponível. Tente novamente.');
    }
    throw error;
  }
}

/**
 * Get advisor response for chat
 */
export async function getAdvisorResponse(
  message: string,
  financialContext: string,
  conversationHistory: ChatMessage[],
  userId: string
): Promise<AdvisorResponse> {
  const settings = await getGlobalSettings();
  const systemPrompt = settings.advisor_prompt || DEFAULT_ADVISOR_PROMPT;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n---\n\nSEUS DADOS FINANCEIROS:\n${financialContext}`,
    },
    ...conversationHistory.filter(m => m.role !== 'system'),
    {
      role: 'user',
      content: message,
    },
  ];

  try {
    const response = await callLLM({
      messages,
      systemPrompt,
      userId,
      responseFormat: 'json',
    });

    if (response.parsed) {
      return response.parsed;
    }

    // Try to extract JSON from response
    if (response.content) {
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('Failed to extract JSON from response');
      }
    }

    // Return fallback response
    return createFallbackResponse('Não foi possível processar a resposta. Tente novamente.');
  } catch (error: any) {
    console.error('Advisor response error:', error);
    // Propagate specific error messages to the user
    const errorMessage = error?.message || 'Ocorreu um erro ao processar sua solicitação.';
    return createFallbackResponse(errorMessage);
  }
}

/**
 * Get daily tip/insight
 */
export async function getDailyTip(
  financialContext: string,
  userId: string
): Promise<AdvisorResponse> {
  const settings = await getGlobalSettings();
  const systemPrompt = (settings as any).tips_prompt || DEFAULT_TIPS_PROMPT;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `Analise os dados financeiros abaixo e gere uma dica do dia personalizada:\n\n${financialContext}`,
    },
  ];

  try {
    const response = await callLLM({
      messages,
      systemPrompt,
      userId,
      responseFormat: 'json',
    });

    if (response.parsed) {
      return response.parsed;
    }

    // Try to extract JSON from response
    if (response.content) {
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('Failed to extract JSON from response');
      }
    }

    return createFallbackResponse('Não foi possível gerar a dica do dia.');
  } catch (error) {
    console.error('Daily tip error:', error);
    return createFallbackResponse('Erro ao gerar dica do dia.');
  }
}

/**
 * Create fallback response when LLM fails
 */
function createFallbackResponse(message: string): AdvisorResponse {
  return {
    summary: message,
    insights: [],
    actions: [],
    confidence: 'low',
    citations: [],
  };
}

/**
 * Estimate token count from text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if tips are enabled
 */
export async function areTipsEnabled(): Promise<boolean> {
  try {
    const settings = await getGlobalSettings();
    return (settings as any).tips_enabled !== false;
  } catch {
    return true;
  }
}

/**
 * Get max tokens for chat history
 */
export async function getMaxHistoryTokens(): Promise<number> {
  try {
    const settings = await getGlobalSettings();
    return (settings as any).chat_max_tokens || 4000;
  } catch {
    return 4000;
  }
}
