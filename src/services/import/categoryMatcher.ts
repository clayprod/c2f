/**
 * Category and Account Matcher Service
 * Handles matching CSV categories/accounts with existing ones and AI categorization
 */

import { categorizeWithHistory } from '@/services/ai/categorization';
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
}

export interface TransactionToMatch {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  categoryName?: string;
  accountName?: string;
}

export interface MatchedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  category_id: string | null;
  category_name: string | null;
  account_id: string | null;
  needs_category_creation: boolean;
  ai_suggested: boolean;
  ai_confidence?: 'low' | 'medium' | 'high';
}

export interface CategoryToCreate {
  name: string;
  type: 'income' | 'expense';
  suggestedFor: string[]; // transaction IDs
}

export interface MatchingResult {
  transactions: MatchedTransaction[];
  categoriesToCreate: CategoryToCreate[];
  unmatchedCount: number;
}

/**
 * Find exact category match by name (case-insensitive)
 */
export function findExactCategoryMatch(
  categoryName: string,
  type: 'income' | 'expense',
  existingCategories: Category[]
): Category | null {
  if (!categoryName || categoryName.trim() === '') {
    return null;
  }

  const normalizedName = categoryName.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = existingCategories.find(
    cat => cat.name.toLowerCase().trim() === normalizedName && cat.type === type
  );
  
  if (exactMatch) {
    return exactMatch;
  }

  return null;
}

/**
 * Find account match by name (case-insensitive)
 */
export function findAccountMatch(
  accountName: string,
  existingAccounts: Account[]
): Account | null {
  if (!accountName || accountName.trim() === '') {
    return null;
  }

  const normalizedName = accountName.toLowerCase().trim();
  
  return existingAccounts.find(
    acc => acc.name.toLowerCase().trim() === normalizedName
  ) || null;
}

/**
 * Check if AI confidence meets threshold
 */
export function meetsConfidenceThreshold(
  confidence: 'low' | 'medium' | 'high',
  threshold: 'low' | 'medium' | 'high' = 'medium'
): boolean {
  const levels = { low: 1, medium: 2, high: 3 };
  return levels[confidence] >= levels[threshold];
}

/**
 * Match transactions with existing categories and accounts
 * Returns transactions with matched IDs and list of categories that need creation
 */
export function matchTransactions(
  transactions: TransactionToMatch[],
  existingCategories: Category[],
  existingAccounts: Account[],
  defaultAccountId: string | null
): MatchingResult {
  const matched: MatchedTransaction[] = [];
  const categoriesToCreateMap = new Map<string, CategoryToCreate>();
  let unmatchedCount = 0;

  for (const tx of transactions) {
    // Try to match category
    let categoryId: string | null = null;
    let categoryName: string | null = null;
    let needsCreation = false;

    if (tx.categoryName && tx.categoryName.trim() !== '') {
      const matchedCategory = findExactCategoryMatch(
        tx.categoryName,
        tx.type,
        existingCategories
      );

      if (matchedCategory) {
        categoryId = matchedCategory.id;
        categoryName = matchedCategory.name;
      } else {
        // Category from CSV doesn't exist - needs creation
        needsCreation = true;
        categoryName = tx.categoryName;
        
        const key = `${tx.categoryName.toLowerCase().trim()}_${tx.type}`;
        if (!categoriesToCreateMap.has(key)) {
          categoriesToCreateMap.set(key, {
            name: tx.categoryName,
            type: tx.type,
            suggestedFor: [tx.id],
          });
        } else {
          categoriesToCreateMap.get(key)!.suggestedFor.push(tx.id);
        }
      }
    } else {
      // No category in CSV - needs AI categorization
      unmatchedCount++;
    }

    // For accounts, always use the default account (user's selection)
    // Don't create accounts from CSV
    const accountId = defaultAccountId;

    matched.push({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      category_id: categoryId,
      category_name: categoryName,
      account_id: accountId,
      needs_category_creation: needsCreation,
      ai_suggested: false,
    });
  }

  return {
    transactions: matched,
    categoriesToCreate: Array.from(categoriesToCreateMap.values()),
    unmatchedCount,
  };
}

/**
 * Process transactions needing AI categorization in batches
 * Returns updated transactions with AI suggestions
 */
export async function processWithAI(
  transactions: MatchedTransaction[],
  existingCategories: Category[],
  userId: string,
  supabase: SupabaseClient,
  batchSize: number = 15,
  signal?: AbortSignal
): Promise<MatchedTransaction[]> {
  // Filter transactions that need AI (no category and not marked for creation)
  const needingAI = transactions.filter(
    tx => !tx.category_id && !tx.needs_category_creation
  );

  if (needingAI.length === 0) {
    return transactions;
  }

  // Check if aborted
  if (signal?.aborted) {
    throw new Error('Operation aborted');
  }

  const results = new Map<string, MatchedTransaction>();
  
  // Initialize results with existing matches
  for (const tx of transactions) {
    if (tx.category_id || tx.needs_category_creation) {
      results.set(tx.id, tx);
    }
  }

  // Process in batches
  for (let i = 0; i < needingAI.length; i += batchSize) {
    // Check abort signal between batches
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const batch = needingAI.slice(i, i + batchSize);
    
    try {
      const aiResult = await categorizeWithHistory(
        batch.map(tx => ({
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          date: tx.date,
        })),
        existingCategories,
        userId,
        supabase,
        { skipHistory: false }
      );

      // Create map of category name to ID
      const categoryNameMap = new Map(
        existingCategories.map(c => [c.name.toLowerCase(), c.id])
      );

      // Process AI results
      for (const aiTx of aiResult.transactions) {
        const originalTx = batch.find(t => t.id === aiTx.id);
        if (!originalTx) continue;

        const categoryId = categoryNameMap.get(aiTx.category.toLowerCase());
        
        if (categoryId && meetsConfidenceThreshold(aiTx.confidence, 'medium')) {
          // Use AI suggestion with sufficient confidence
          results.set(aiTx.id, {
            ...originalTx,
            category_id: categoryId,
            category_name: aiTx.category,
            ai_suggested: true,
            ai_confidence: aiTx.confidence,
          });
        } else {
          // AI confidence too low - mark as needing creation with AI suggestion
          results.set(aiTx.id, {
            ...originalTx,
            category_name: aiTx.category,
            needs_category_creation: true,
            ai_suggested: true,
            ai_confidence: aiTx.confidence,
          });
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < needingAI.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('Error processing AI batch:', error);
      // Continue with remaining batches
      // Mark failed transactions as needing creation
      for (const tx of batch) {
        if (!results.has(tx.id)) {
          results.set(tx.id, {
            ...tx,
            needs_category_creation: true,
            category_name: 'Outros',
          });
        }
      }
    }
  }

  // Return in original order
  return transactions.map(tx => results.get(tx.id) || tx);
}

/**
 * Create categories in batch
 */
export async function createCategories(
  categoriesToCreate: CategoryToCreate[],
  userId: string,
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const createdMap = new Map<string, string>();

  if (categoriesToCreate.length === 0) {
    return createdMap;
  }

  const colorPalette = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'];
  const getRandomColor = () => colorPalette[Math.floor(Math.random() * colorPalette.length)];

  // Prepare insert data
  const insertData = categoriesToCreate.map(cat => ({
    user_id: userId,
    name: cat.name,
    type: cat.type,
    icon: cat.type === 'income' ? '💰' : '💸',
    color: getRandomColor(),
  }));

  try {
    const { data, error } = await supabase
      .from('categories')
      .insert(insertData)
      .select('id, name, type');

    if (error) {
      throw error;
    }

    // Build map of category key to ID
    for (const cat of data || []) {
      const key = `${cat.name.toLowerCase().trim()}_${cat.type}`;
      createdMap.set(key, cat.id);
    }
  } catch (error) {
    console.error('Error creating categories:', error);
    throw error;
  }

  return createdMap;
}

/**
 * Update transactions with newly created category IDs
 */
export function updateTransactionsWithNewCategories(
  transactions: MatchedTransaction[],
  createdCategoriesMap: Map<string, string>
): MatchedTransaction[] {
  return transactions.map(tx => {
    if (tx.needs_category_creation && tx.category_name) {
      const key = `${tx.category_name.toLowerCase().trim()}_${tx.type}`;
      const newCategoryId = createdCategoriesMap.get(key);
      
      if (newCategoryId) {
        return {
          ...tx,
          category_id: newCategoryId,
          needs_category_creation: false,
        };
      }
    }
    return tx;
  });
}
