import { getGroqClient } from './client';

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

export async function getAdvisorResponse(
  message: string,
  financialData: any,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AdvisorResponse> {
  const groq = getGroqClient();

  const systemPrompt = `Você é um AI Advisor financeiro especializado em análise de finanças pessoais.
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

  const userPrompt = `Dados financeiros do usuário:
${JSON.stringify(financialData, null, 2)}

Pergunta do usuário: ${message}

${conversationHistory ? `Histórico da conversa:\n${JSON.stringify(conversationHistory, null, 2)}` : ''}

Forneça uma resposta estruturada em JSON conforme o formato especificado.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama-3.1-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Groq');
    }

    const parsed = JSON.parse(content);
    return parsed as AdvisorResponse;
  } catch (error) {
    console.error('Groq API error:', error);
    // Fallback response
    return {
      summary: 'Não foi possível processar sua solicitação no momento. Tente novamente.',
      insights: [],
      actions: [],
      confidence: 'low',
      citations: [],
    };
  }
}


