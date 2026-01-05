import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { goalContributionSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('goal_contributions')
      .select('*, transactions(*)')
      .eq('goal_id', id)
      .eq('user_id', userId)
      .order('contribution_date', { ascending: false });

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = goalContributionSchema.parse({
      ...body,
      goal_id: id,
    });

    const { supabase } = createClientFromRequest(request);

    // Create contribution
    const { data: contribution, error: contributionError } = await supabase
      .from('goal_contributions')
      .insert({
        ...validated,
        user_id: userId,
        amount_cents: validated.amount_cents,
      })
      .select()
      .single();

    if (contributionError) throw contributionError;

    // Update goal's current amount
    const { data: goal } = await supabase
      .from('goals')
      .select('current_amount_cents, target_amount_cents, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (goal) {
      const currentAmount = typeof goal.current_amount_cents === 'string'
        ? parseInt(goal.current_amount_cents)
        : goal.current_amount_cents;
      const targetAmount = typeof goal.target_amount_cents === 'string'
        ? parseInt(goal.target_amount_cents)
        : goal.target_amount_cents;
      const newCurrentAmount = currentAmount + validated.amount_cents;
      const newStatus = newCurrentAmount >= targetAmount 
        ? 'completed' 
        : goal.status === 'completed' && newCurrentAmount < targetAmount
        ? 'active'
        : goal.status;

      await supabase
        .from('goals')
        .update({
          current_amount_cents: newCurrentAmount,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId);
    }

    return NextResponse.json({ data: contribution }, { status: 201 });
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
