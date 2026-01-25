/**
 * History-based Category Suggester
 * Finds similar transactions from user's history to suggest categories
 * before falling back to AI categorization
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TransactionToSuggest {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface HistoryMatch {
  id: string;
  category_id: string;
  category_name: string;
  confidence: 'low' | 'medium' | 'high';
  match_type: 'exact' | 'prefix' | 'keyword';
  source: 'history';
}

export interface HistorySuggestionResult {
  matched: HistoryMatch[];
  unmatched: TransactionToSuggest[];
}

interface CategoryPattern {
  description: string;
  normalized: string;
  category_id: string;
  category_name: string;
  category_type: 'income' | 'expense';
  frequency: number;
}

// Cache for patterns during a categorization session
const patternCache: Map<string, CategoryPattern[]> = new Map();

/**
 * Normalize description for comparison
 * - Lowercase
 * - Remove extra spaces
 * - Remove trailing numbers/IDs (common in bank transactions)
 * - Trim
 */
export function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\d{4,}$/g, '') // Remove trailing numbers (4+ digits)
    .replace(/[*#]+\d+$/g, '') // Remove patterns like *123 or #456
    .replace(/\s*-\s*\d+\/\d+\s*$/g, '') // Remove installment patterns like "- 1/12"
    .trim();
}

/**
 * Extract core words from description (first 2-3 significant words)
 * Useful for matching "UBER" in "UBER TRIP 123456"
 */
export function extractCoreWords(description: string): string[] {
  const normalized = normalizeDescription(description);
  const words = normalized.split(' ').filter(w => w.length >= 3);
  
  // Skip common prefixes that don't help with matching
  const skipWords = new Set(['pix', 'ted', 'doc', 'deb', 'cred', 'pgto', 'pagto', 'receb', 'transf']);
  
  const significantWords = words.filter(w => !skipWords.has(w));
  
  // Return first 3 significant words, or all if less
  return significantWords.slice(0, 3);
}

/**
 * Calculate similarity score between two descriptions
 * Returns a score from 0 to 1
 */
function calculateSimilarity(desc1: string, desc2: string): { score: number; type: 'exact' | 'prefix' | 'keyword' | 'none' } {
  const norm1 = normalizeDescription(desc1);
  const norm2 = normalizeDescription(desc2);
  
  // Exact match
  if (norm1 === norm2) {
    return { score: 1.0, type: 'exact' };
  }
  
  // Prefix match (one starts with the other)
  if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    // Only consider prefix match if the prefix is at least 5 chars
    if (minLen >= 5) {
      return { score: 0.8 + (0.2 * minLen / maxLen), type: 'prefix' };
    }
  }
  
  // Core words match
  const words1 = extractCoreWords(desc1);
  const words2 = extractCoreWords(desc2);
  
  if (words1.length > 0 && words2.length > 0) {
    // Check if first significant word matches
    if (words1[0] === words2[0]) {
      const matchingWords = words1.filter(w => words2.includes(w));
      const matchRatio = matchingWords.length / Math.max(words1.length, words2.length);
      if (matchRatio >= 0.5) {
        return { score: 0.6 + (0.2 * matchRatio), type: 'keyword' };
      }
    }
  }
  
  return { score: 0, type: 'none' };
}

/**
 * Load category patterns from user's transaction history
 * Caches results for the session
 */
async function loadCategoryPatterns(
  userId: string,
  supabase: SupabaseClient
): Promise<CategoryPattern[]> {
  // Check cache first
  if (patternCache.has(userId)) {
    return patternCache.get(userId)!;
  }
  
  // Query user's categorized transactions from last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      description,
      category_id,
      categories!inner (
        id,
        name,
        type
      )
    `)
    .eq('user_id', userId)
    .not('category_id', 'is', null)
    .gte('posted_at', sixMonthsAgo.toISOString().split('T')[0])
    .order('posted_at', { ascending: false })
    .limit(1000);
  
  if (error) {
    console.error('Error loading category patterns:', error);
    return [];
  }
  
  // Group by normalized description and count frequency
  const patternMap = new Map<string, CategoryPattern>();
  
  for (const tx of data || []) {
    const normalized = normalizeDescription(tx.description);
    const key = `${normalized}|${tx.category_id}`;
    
    const category = tx.categories as unknown as { id: string; name: string; type: string };
    
    if (patternMap.has(key)) {
      patternMap.get(key)!.frequency++;
    } else {
      patternMap.set(key, {
        description: tx.description,
        normalized,
        category_id: tx.category_id,
        category_name: category.name,
        category_type: category.type as 'income' | 'expense',
        frequency: 1,
      });
    }
  }
  
  // Convert to array and sort by frequency
  const patterns = Array.from(patternMap.values())
    .sort((a, b) => b.frequency - a.frequency);
  
  // Cache for this user
  patternCache.set(userId, patterns);
  
  return patterns;
}

/**
 * Find best matching category for a transaction based on history
 */
function findBestMatch(
  transaction: TransactionToSuggest,
  patterns: CategoryPattern[]
): HistoryMatch | null {
  // Determine expected category type based on amount
  const expectedType: 'income' | 'expense' = transaction.amount >= 0 ? 'income' : 'expense';
  
  let bestMatch: { pattern: CategoryPattern; score: number; type: 'exact' | 'prefix' | 'keyword' } | null = null;
  
  for (const pattern of patterns) {
    // Skip if category type doesn't match transaction direction
    if (pattern.category_type !== expectedType) {
      continue;
    }
    
    const { score, type } = calculateSimilarity(transaction.description, pattern.description);
    
    // Minimum threshold for a match - skip 'none' type (no similarity)
    if (score < 0.6 || type === 'none') {
      continue;
    }
    
    // Boost score based on frequency (more common = more likely correct)
    const frequencyBoost = Math.min(0.1, pattern.frequency * 0.01);
    const adjustedScore = score + frequencyBoost;
    
    if (!bestMatch || adjustedScore > bestMatch.score) {
      bestMatch = { pattern, score: adjustedScore, type: type as 'exact' | 'prefix' | 'keyword' };
    }
  }
  
  if (!bestMatch) {
    return null;
  }
  
  // Determine confidence based on match type and score
  let confidence: 'low' | 'medium' | 'high';
  if (bestMatch.type === 'exact' || bestMatch.score >= 0.95) {
    confidence = 'high';
  } else if (bestMatch.type === 'prefix' || bestMatch.score >= 0.75) {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }
  
  return {
    id: transaction.id,
    category_id: bestMatch.pattern.category_id,
    category_name: bestMatch.pattern.category_name,
    confidence,
    match_type: bestMatch.type,
    source: 'history',
  };
}

/**
 * Main function: suggest categories from user's transaction history
 */
export async function suggestFromHistory(
  transactions: TransactionToSuggest[],
  userId: string,
  supabase: SupabaseClient
): Promise<HistorySuggestionResult> {
  if (transactions.length === 0) {
    return { matched: [], unmatched: [] };
  }
  
  try {
    // Load patterns from history
    const patterns = await loadCategoryPatterns(userId, supabase);
    
    if (patterns.length === 0) {
      // No history available, all transactions need AI
      return { matched: [], unmatched: transactions };
    }
    
    const matched: HistoryMatch[] = [];
    const unmatched: TransactionToSuggest[] = [];
    
    for (const tx of transactions) {
      const match = findBestMatch(tx, patterns);
      
      if (match) {
        matched.push(match);
      } else {
        unmatched.push(tx);
      }
    }
    
    console.log(`[HistorySuggester] Matched ${matched.length}/${transactions.length} from history`);
    
    return { matched, unmatched };
  } catch (error) {
    console.error('[HistorySuggester] Error:', error);
    // On error, fallback to all needing AI
    return { matched: [], unmatched: transactions };
  }
}

/**
 * Clear the pattern cache (useful between import sessions)
 */
export function clearPatternCache(userId?: string): void {
  if (userId) {
    patternCache.delete(userId);
  } else {
    patternCache.clear();
  }
}
