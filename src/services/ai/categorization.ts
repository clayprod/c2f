/**
 * AI Transaction Categorization Service
 * Uses LLM to categorize transactions based on their descriptions
 */

import { callLLM, getAPIConfig } from '@/services/advisor/llm';
import { getGlobalSettings } from '@/services/admin/globalSettings';

export interface TransactionToCategorize {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface CategorizedTransaction {
  id: string;
  category: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface CategorizationResult {
  transactions: CategorizedTransaction[];
  success: boolean;
  error?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

const DEFAULT_CATEGORIZATION_PROMPT = `Voce e um assistente financeiro especializado em categorizar transacoes bancarias.
Analise as transacoes abaixo e sugira a categoria mais adequada baseado na descricao.

Categorias disponiveis: {categories}

Para cada transacao, retorne um JSON valido com a seguinte estrutura:
{
  "transactions": [
    { "id": "id_da_transacao", "category": "nome_categoria_exato", "confidence": "low|medium|high" }
  ]
}

Regras:
1. Use APENAS categorias da lista fornecida (nome exato)
2. Se nao conseguir identificar com certeza, use "Outros" com confidence "low"
3. Analise palavras-chave comuns: supermercado, restaurante, uber, ifood, netflix, farmacia, etc.
4. Considere o valor da transacao para contexto adicional
5. Para transferencias entre contas proprias, use "Transferencia" se disponivel ou "Outros"
6. Retorne APENAS o JSON, sem explicacoes adicionais`;

/**
 * Categorize a batch of transactions using AI
 */
export async function categorizeTransactions(
  transactions: TransactionToCategorize[],
  userCategories: Category[],
  userId: string
): Promise<CategorizationResult> {
  if (transactions.length === 0) {
    return { transactions: [], success: true };
  }

  // Check if AI is available
  const config = await getAPIConfig(userId);
  if (!config.apiKey) {
    return {
      transactions: transactions.map(tx => ({
        id: tx.id,
        category: 'Outros',
        confidence: 'low' as const,
      })),
      success: false,
      error: 'AI not configured',
    };
  }

  try {
    // Get custom prompt or use default
    const settings = await getGlobalSettings();
    let prompt = (settings as any).categorization_prompt || DEFAULT_CATEGORIZATION_PROMPT;

    // Build category list
    const categoryNames = userCategories.map(c => c.name).join(', ');
    prompt = prompt.replace('{categories}', categoryNames);

    // Prepare transactions for the prompt
    const transactionList = transactions
      .map(tx => `- ID: ${tx.id} | Data: ${tx.date} | Valor: R$ ${tx.amount.toFixed(2)} | Descricao: ${tx.description}`)
      .join('\n');

    const userMessage = `Categorize as seguintes transacoes:\n\n${transactionList}`;
    
    const messages = [
      {
        role: 'system' as const,
        content: prompt,
      },
      {
        role: 'user' as const,
        content: userMessage,
      },
    ];

    const response = await callLLM({
      messages,
      systemPrompt: prompt,
      userId,
      responseFormat: 'json',
    });

    const parsedData = response.parsed as any;
    if (parsedData && parsedData.transactions) {
      // Validate and normalize the response
      const validCategories = new Set(userCategories.map(c => c.name.toLowerCase()));
      
      const categorized = (parsedData.transactions as any[]).map((tx: any) => {
        const category = tx.category || 'Outros';
        const isValid = validCategories.has(category.toLowerCase());
        
        return {
          id: tx.id,
          category: isValid ? category : 'Outros',
          confidence: isValid ? (tx.confidence || 'medium') : 'low',
        };
      });

      return {
        transactions: categorized,
        success: true,
      };
    }

    // Try to parse from content
    if (response.content) {
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.transactions) {
            return {
              transactions: parsed.transactions,
              success: true,
            };
          }
        }
      } catch (e) {
        console.error('Failed to parse categorization response:', e);
      }
    }

    // Fallback - return all as "Outros"
    return {
      transactions: transactions.map(tx => ({
        id: tx.id,
        category: 'Outros',
        confidence: 'low' as const,
      })),
      success: false,
      error: 'Failed to parse AI response',
    };
  } catch (error: any) {
    console.error('Categorization error:', error);
    
    // Return fallback
    return {
      transactions: transactions.map(tx => ({
        id: tx.id,
        category: 'Outros',
        confidence: 'low' as const,
      })),
      success: false,
      error: error.message,
    };
  }
}

/**
 * Categorize a single transaction
 */
export async function categorizeSingleTransaction(
  transaction: TransactionToCategorize,
  userCategories: Category[],
  userId: string
): Promise<CategorizedTransaction> {
  const result = await categorizeTransactions([transaction], userCategories, userId);
  return result.transactions[0] || {
    id: transaction.id,
    category: 'Outros',
    confidence: 'low',
  };
}

/**
 * Batch categorize with chunking for large sets
 */
export async function categorizeLargeSet(
  transactions: TransactionToCategorize[],
  userCategories: Category[],
  userId: string,
  chunkSize = 20
): Promise<CategorizationResult> {
  if (transactions.length <= chunkSize) {
    return categorizeTransactions(transactions, userCategories, userId);
  }

  const results: CategorizedTransaction[] = [];
  let hasError = false;
  let errorMessage = '';

  // Process in chunks
  for (let i = 0; i < transactions.length; i += chunkSize) {
    const chunk = transactions.slice(i, i + chunkSize);
    const chunkResult = await categorizeTransactions(chunk, userCategories, userId);
    
    results.push(...chunkResult.transactions);
    
    if (!chunkResult.success) {
      hasError = true;
      errorMessage = chunkResult.error || 'Unknown error';
    }

    // Small delay between chunks to avoid rate limiting
    if (i + chunkSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    transactions: results,
    success: !hasError,
    error: hasError ? errorMessage : undefined,
  };
}
