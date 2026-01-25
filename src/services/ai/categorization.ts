/**
 * AI Transaction Categorization Service
 * Uses LLM to categorize transactions based on their descriptions
 * Now with history-based suggestions for better accuracy and lower costs
 */

import { callLLM, getAPIConfig } from '@/services/advisor/llm';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  suggestFromHistory,
  clearPatternCache,
  type TransactionToSuggest,
  type HistoryMatch,
} from '@/services/categorization/historySuggester';

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

const DEFAULT_CATEGORIZATION_PROMPT = `Você é um assistente financeiro especializado em categorizar transações bancárias.
Analise as transações abaixo e sugira a categoria mais adequada baseado na descrição.

Categorias disponíveis: {categories}

Para cada transação, retorne um JSON válido com a seguinte estrutura:
{
  "transactions": [
    { "id": "id_da_transacao", "category": "nome_categoria_exato", "confidence": "low|medium|high" }
  ]
}

Regras:
1. Use APENAS categorias da lista fornecida (nome exato)
2. Se não conseguir identificar com certeza, use "Outros" com confidence "low"
3. Analise palavras-chave comuns: supermercado, restaurante, uber, ifood, netflix, farmacia, etc.
4. Considere o valor da transação para contexto adicional
5. Para transferências entre contas próprias, use "Transferência" se disponível ou "Outros"
6. Retorne APENAS o JSON, sem explicações adicionais`;

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
      .map(tx => `- ID: ${tx.id} | Data: ${tx.date} | Valor: R$ ${tx.amount.toFixed(2)} | Descrição: ${tx.description}`)
      .join('\n');

    const userMessage = `Categorize as seguintes transações:\n\n${transactionList}`;
    
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

/**
 * Smart categorization: uses history-based suggestions first, then AI for unmatched
 * This is the recommended entry point for categorization
 */
export async function categorizeWithHistory(
  transactions: TransactionToCategorize[],
  userCategories: Category[],
  userId: string,
  supabase: SupabaseClient,
  options: { skipHistory?: boolean } = {}
): Promise<CategorizationResult> {
  if (transactions.length === 0) {
    return { transactions: [], success: true };
  }

  // If skipHistory is true, go straight to AI
  if (options.skipHistory) {
    return transactions.length > 20
      ? categorizeLargeSet(transactions, userCategories, userId)
      : categorizeTransactions(transactions, userCategories, userId);
  }

  try {
    // Step 1: Try to match from user's transaction history
    const historyResult = await suggestFromHistory(
      transactions as TransactionToSuggest[],
      userId,
      supabase
    );

    // Build category name to ID map for converting history matches
    const categoryMap = new Map(userCategories.map(c => [c.name.toLowerCase(), c]));

    // Convert history matches to CategorizedTransaction format
    const matchedFromHistory: CategorizedTransaction[] = historyResult.matched.map(match => ({
      id: match.id,
      category: match.category_name,
      confidence: match.confidence,
    }));

    // Step 2: Use AI for unmatched transactions
    let aiResults: CategorizedTransaction[] = [];
    let aiSuccess = true;
    let aiError: string | undefined;

    if (historyResult.unmatched.length > 0) {
      console.log(`[Categorization] ${historyResult.unmatched.length} transactions need AI categorization`);
      
      const aiResult = historyResult.unmatched.length > 20
        ? await categorizeLargeSet(historyResult.unmatched, userCategories, userId)
        : await categorizeTransactions(historyResult.unmatched, userCategories, userId);
      
      aiResults = aiResult.transactions;
      aiSuccess = aiResult.success;
      aiError = aiResult.error;
    }

    // Step 3: Combine results preserving original order
    const allResults = new Map<string, CategorizedTransaction>();
    
    for (const tx of matchedFromHistory) {
      allResults.set(tx.id, tx);
    }
    
    for (const tx of aiResults) {
      allResults.set(tx.id, tx);
    }

    // Rebuild in original order
    const orderedResults = transactions.map(tx => 
      allResults.get(tx.id) || { id: tx.id, category: 'Outros', confidence: 'low' as const }
    );

    const historyMatchCount = matchedFromHistory.length;
    const aiMatchCount = aiResults.length;
    
    console.log(`[Categorization] Complete: ${historyMatchCount} from history, ${aiMatchCount} from AI`);

    return {
      transactions: orderedResults,
      success: aiSuccess,
      error: aiError,
    };
  } catch (error: any) {
    console.error('[categorizeWithHistory] Error:', error);
    
    // Fallback to pure AI categorization
    return transactions.length > 20
      ? categorizeLargeSet(transactions, userCategories, userId)
      : categorizeTransactions(transactions, userCategories, userId);
  }
}

/**
 * Clear the history pattern cache for a user
 * Call this after importing transactions to refresh patterns
 */
export { clearPatternCache };
