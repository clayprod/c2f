import { getGroqClient } from './client';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserPlan } from '@/services/stripe/subscription';
import OpenAI from 'openai';

export interface AdvisorResponse {
  summary: string;
  insights: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  actions: Array<{
    type: string;
    payload: any;
    confidence: 'low' | 'medium' | 'high';
  }>;
  confidence: 'low' | 'medium' | 'high';
  citations: Array<{
    type: string;
    id: string;
    reference: string;
  }>;
}

const DEFAULT_ADVISOR_PROMPT = `Você é um AI Advisor financeiro especializado em análise de finanças pessoais.
Sua função é analisar dados financeiros e fornecer insights estruturados e ações sugeridas.

IMPORTANTE: Você DEVE sempre retornar uma resposta em formato JSON válido com a seguinte estrutura:
{
  "summary": "resumo curto em 1-2 frases",
  "insights": [
    {
      "type": "tipo do insight (ex: 'spending_pattern', 'budget_alert', 'savings_opportunity')",
      "message": "descrição do insight",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "tipo da ação (ex: 'create_budget', 'adjust_spending', 'create_goal')",
      "payload": { "dados específicos da ação" },
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "citations": [
    {
      "type": "transaction|account|budget|category",
      "id": "id do recurso",
      "reference": "referência textual"
    }
  ]
}

Analise os dados financeiros fornecidos e forneça recomendações práticas e acionáveis.`;


async function callAI(
  systemPrompt: string,
  userPrompt: string,
  model: 'groq' | 'openai',
  modelName: string,
  apiKey: string
): Promise<string> {
  if (model === 'openai') {
    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: modelName || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  } else {
    // Use Groq
    const groq = await getGroqClient();
    const completion = await groq.chat.completions.create({
      model: modelName || 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content || '';
  }
}

export async function getAdvisorResponse(
  message: string,
  financialData: any,
  conversationHistory?: Array<{ role: string; content: string }>,
  userId?: string
): Promise<AdvisorResponse> {
  try {
    // Get global settings
    const settings = await getGlobalSettings();

    // Check if user has paid plan to use global keys
    let useGlobalKeys = false;
    if (userId) {
      try {
        const plan = await getUserPlan(userId);
        useGlobalKeys = plan.plan === 'pro' || plan.plan === 'premium';
      } catch (error) {
        console.error('Error checking user plan:', error);
      }
    }

    // Determine API key and model
    const aiModel = settings.ai_model || 'groq';
    const aiModelName = settings.ai_model_name || (aiModel === 'groq' ? 'llama-3.1-70b-versatile' : 'gpt-4');

    let apiKey: string;
    if (useGlobalKeys && settings.groq_api_key && aiModel === 'groq') {
      apiKey = settings.groq_api_key;
    } else if (useGlobalKeys && settings.openai_api_key && aiModel === 'openai') {
      apiKey = settings.openai_api_key;
    } else if (aiModel === 'groq') {
      apiKey = process.env.GROQ_API_KEY || '';
    } else {
      apiKey = process.env.OPENAI_API_KEY || '';
    }

    if (!apiKey) {
      throw new Error('API key not available');
    }

    const systemPrompt = settings.advisor_prompt || DEFAULT_ADVISOR_PROMPT;
    const userPrompt = `Dados financeiros do usuário:
${JSON.stringify(financialData, null, 2)}

Pergunta do usuário: ${message}

${conversationHistory ? `Histórico da conversa:\n${JSON.stringify(conversationHistory, null, 2)}` : ''}

Forneça uma resposta estruturada em JSON conforme o formato especificado.`;

    const content = await callAI(systemPrompt, userPrompt, aiModel, aiModelName, apiKey);

    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return parsed as AdvisorResponse;
  } catch (error) {
    console.error('AI API error:', error);
    return {
      summary: 'Não foi possível processar sua solicitação no momento. Tente novamente.',
      insights: [],
      actions: [],
      confidence: 'low',
      citations: [],
    };
  }
}

export async function getAdvisorInsights(
  financialData: any,
  userId: string
): Promise<AdvisorResponse> {
  try {
    const settings = await getGlobalSettings();
    const plan = await getUserPlan(userId);
    const useGlobalKeys = plan.plan === 'pro' || plan.plan === 'premium';

    const aiModel = settings.ai_model || 'groq';
    const aiModelName = settings.ai_model_name || (aiModel === 'groq' ? 'llama-3.1-70b-versatile' : 'gpt-4');

    let apiKey: string;
    if (useGlobalKeys && settings.groq_api_key && aiModel === 'groq') {
      apiKey = settings.groq_api_key;
    } else if (useGlobalKeys && settings.openai_api_key && aiModel === 'openai') {
      apiKey = settings.openai_api_key;
    } else if (aiModel === 'groq') {
      apiKey = process.env.GROQ_API_KEY || '';
    } else {
      apiKey = process.env.OPENAI_API_KEY || '';
    }

    if (!apiKey) {
      throw new Error('API key not available');
    }

    // Use tips_prompt for insights generation (legacy function, now uses tips prompt)
    const systemPrompt = settings.tips_prompt || DEFAULT_ADVISOR_PROMPT;
    const userPrompt = `Dados financeiros do usuário:
${JSON.stringify(financialData, null, 2)}

Gere insights diários sobre a situação financeira do usuário.`;

    const content = await callAI(systemPrompt, userPrompt, aiModel, aiModelName, apiKey);

    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return parsed as AdvisorResponse;
  } catch (error) {
    console.error('AI API error:', error);
    return {
      summary: 'Não foi possível gerar insights no momento. Tente novamente.',
      insights: [],
      actions: [],
      confidence: 'low',
      citations: [],
    };
  }
}





