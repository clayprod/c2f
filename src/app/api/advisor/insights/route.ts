import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getAdvisorInsights } from '@/services/groq/advisor';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check if user already has an insight today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingInsight } = await supabase
      .from('advisor_insights')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .maybeSingle();

    if (existingInsight) {
      return NextResponse.json(
        { error: 'Você já gerou seu insight de hoje. Tente novamente amanhã.' },
        { status: 429 }
      );
    }

    // Get financial data for the user
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

    // Get advisor insights
    const advisorResponse = await getAdvisorInsights(financialData, userId);

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
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


