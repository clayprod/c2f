import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { investmentTransactionSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('investment_transactions')
      .select('*, transactions(*)')
      .eq('investment_id', params.id)
      .eq('user_id', ownerId)
      .order('transaction_date', { ascending: false });

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
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = investmentTransactionSchema.parse({
      ...body,
      investment_id: params.id,
    });

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('investment_transactions')
      .insert({
        ...validated,
        user_id: ownerId,
        amount_cents: validated.amount_cents,
      })
      .select()
      .single();

    if (error) throw error;

    // Update investment value if needed
    if (validated.type === 'buy' || validated.type === 'sell' || validated.type === 'adjustment') {
      const { data: investment } = await supabase
        .from('investments')
        .select('current_value_cents')
        .eq('id', params.id)
        .eq('user_id', ownerId)
        .single();

      if (investment) {
        const currentValue = typeof investment.current_value_cents === 'string'
          ? parseInt(investment.current_value_cents)
          : investment.current_value_cents;
        let newValue = currentValue;
        if (validated.type === 'buy') {
          newValue += validated.amount_cents;
        } else if (validated.type === 'sell') {
          newValue -= validated.amount_cents;
        } else if (validated.type === 'adjustment') {
          newValue = validated.amount_cents;
        }

        await supabase
          .from('investments')
          .update({
            current_value_cents: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .eq('user_id', ownerId);
      }
    }

    projectionCache.invalidateUser(ownerId);

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
