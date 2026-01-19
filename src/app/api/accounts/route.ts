import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { accountSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', ownerId)
      .neq('type', 'credit_card')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Convert current_balance (NUMERIC) to balance_cents (BIGINT) for API response
    const transformedData = (data || []).map((account: any) => ({
      ...account,
      balance_cents: Math.round((account.current_balance || 0) * 100),
    }));

    return NextResponse.json({ data: transformedData });
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
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const validated = accountSchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        name: validated.name,
        type: validated.type,
        current_balance: validated.balance_cents / 100, // Convert cents to NUMERIC (reais)
        currency: validated.currency,
        institution: validated.institution,
        user_id: ownerId,
      })
      .select()
      .single();

    if (error) throw error;

    // Convert current_balance (NUMERIC) to balance_cents (BIGINT) for API response
    const transformedData = {
      ...data,
      balance_cents: Math.round((data.current_balance || 0) * 100),
    };

    return NextResponse.json({ data: transformedData }, { status: 201 });
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

