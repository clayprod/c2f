import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseCSV } from '@/services/import/csvParser';
import { createErrorResponse } from '@/lib/errors';
import {
  matchTransactions,
  processWithAI,
  type TransactionToMatch,
  type MatchedTransaction,
} from '@/services/import/categoryMatcher';

/**
 * Preview CSV transactions without importing
 * Matches categories and accounts with existing ones
 * Uses AI only for transactions without category
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { csv_content, account_id } = body;

    if (!csv_content) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Parse CSV file
    const parsedTransactions = parseCSV(csv_content);

    if (parsedTransactions.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma transação válida encontrada no CSV. Verifique o formato.' },
        { status: 400 }
      );
    }

    // Fetch existing categories
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('id, name, type, icon, color')
      .eq('user_id', userId);

    // Fetch existing accounts
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', userId);

    // Convert to match format
    const transactionsToMatch: TransactionToMatch[] = parsedTransactions.map((tx, index) => ({
      id: tx.id || `csv-${index}`,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      categoryName: tx.categoryName,
      accountName: tx.accountName,
    }));

    // Step 1: Match with existing categories and accounts
    const matchingResult = matchTransactions(
      transactionsToMatch,
      existingCategories || [],
      existingAccounts || [],
      account_id || null
    );

    // Step 2: Process transactions needing AI categorization
    let finalTransactions: MatchedTransaction[] = matchingResult.transactions;
    
    if (matchingResult.unmatchedCount > 0) {
      try {
        finalTransactions = await processWithAI(
          matchingResult.transactions,
          existingCategories || [],
          userId,
          supabase,
          15, // batch size
          undefined // no abort signal in API route
        );
      } catch (error) {
        console.error('AI categorization error:', error);
        // Continue with partial results - transactions without AI will be marked for creation
      }
    }

    // Convert to preview format
    const previewTransactions = finalTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
      type: tx.type,
      category_id: tx.category_id,
      category_name: tx.category_name,
      account_id: tx.account_id,
      needs_category_creation: tx.needs_category_creation,
      ai_suggested: tx.ai_suggested,
      ai_confidence: tx.ai_confidence,
    }));

    return NextResponse.json({
      transactions: previewTransactions,
      categories_to_create: matchingResult.categoriesToCreate.map(cat => ({
        name: cat.name,
        type: cat.type,
        count: cat.suggestedFor.length,
      })),
      stats: {
        total: previewTransactions.length,
        with_category: previewTransactions.filter(t => t.category_id).length,
        needs_creation: previewTransactions.filter(t => t.needs_category_creation).length,
        ai_suggested: previewTransactions.filter(t => t.ai_suggested).length,
      },
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
