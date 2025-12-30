import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { advisorChatSchema } from '@/lib/validation/schemas';
import { getAdvisorResponse } from '@/services/groq/advisor';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = advisorChatSchema.parse(body);

    // Get financial data for the user
    const supabase = await createClient();
    
    const [accountsRes, transactionsRes, budgetsRes, categoriesRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('transactions').select('*').eq('user_id', userId).limit(100),
      supabase.from('budgets').select('*, categories(*)').eq('user_id', userId),
      supabase.from('categories').select('*').eq('user_id', userId),
    ]);

    const financialData = {
      accounts: accountsRes.data || [],
      transactions: transactionsRes.data || [],
      budgets: budgetsRes.data || [],
      categories: categoriesRes.data || [],
    };

    // Get advisor response
    const advisorResponse = await getAdvisorResponse(
      validated.message,
      financialData,
      validated.conversationHistory
    );

    // Save insight to database
    await supabase.from('advisor_insights').insert({
      user_id: userId,
      summary: advisorResponse.summary,
      insights: advisorResponse.insights,
      actions: advisorResponse.actions,
      confidence: advisorResponse.confidence,
      citations: advisorResponse.citations,
    });

    return NextResponse.json(advisorResponse);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

