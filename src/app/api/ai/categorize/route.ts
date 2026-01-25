import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categorizeWithHistory } from '@/services/ai/categorization';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactions, skipHistory } = body as {
      transactions: Array<{
        id: string;
        description: string;
        amount: number;
        date: string;
      }>;
      skipHistory?: boolean;
    };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'transactions array is required' },
        { status: 400 }
      );
    }

    // Limit to prevent abuse
    if (transactions.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 transactions per request' },
        { status: 400 }
      );
    }

    // Get user's categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (catError) {
      console.error('Error fetching categories:', catError);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    // Use smart categorization with history-based suggestions first, then AI
    const result = await categorizeWithHistory(
      transactions,
      categories || [],
      user.id,
      supabase,
      { skipHistory: skipHistory || false }
    );

    return NextResponse.json({
      transactions: result.transactions,
      success: result.success,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Error in POST /api/ai/categorize:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
