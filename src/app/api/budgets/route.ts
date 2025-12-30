import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { budgetSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    const supabase = await createClient();
    let query = supabase
      .from('budgets')
      .select('*, categories(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const yearNum = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      query = query.eq('year', yearNum).eq('month', monthNum);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = budgetSchema.parse(body);

    const supabase = await createClient();
    // Parse month to year and month integers
    const monthDate = new Date(validated.month);
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        category_id: validated.category_id,
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1,
        amount_planned: validated.limit_cents / 100, // Convert cents to reais
        user_id: userId,
      })
      .select('*, categories(*)')
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
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

