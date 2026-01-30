import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { accountSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { logDataAccess, logDataModification } from '@/lib/audit';

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
      .select('*, transactions(count)')
      .eq('user_id', ownerId)
      .neq('type', 'credit_card')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Log data access
    await logDataAccess(ownerId, 'accounts', undefined, request).catch((err) =>
      console.error('[Audit] Failed to log account access:', err)
    );

    // Convert current_balance (NUMERIC) to balance_cents (BIGINT) for API response
    const transformedData = (data || []).map((account: any) => {
      const transactionsCount = account.transactions?.[0]?.count ?? 0;
      const { transactions, ...rest } = account;
      return {
        ...rest,
        balance_cents: Math.round((account.current_balance || 0) * 100),
        initial_balance_cents: Math.round((account.initial_balance || 0) * 100),
        has_transactions: transactionsCount > 0,
      };
    });

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
    const initialBalanceCents =
      validated.initial_balance_cents ?? validated.balance_cents ?? 0;
    const insertData: any = {
      name: validated.name,
      type: validated.type,
      initial_balance: initialBalanceCents / 100,
      current_balance: initialBalanceCents / 100, // Convert cents to NUMERIC (reais)
      currency: validated.currency,
      institution: validated.institution,
      user_id: ownerId,
    };

    // Add overdraft fields if provided
    if (validated.overdraft_limit_cents !== undefined) {
      insertData.overdraft_limit_cents = validated.overdraft_limit_cents;
    }
    if (validated.overdraft_interest_rate_monthly !== undefined) {
      insertData.overdraft_interest_rate_monthly = validated.overdraft_interest_rate_monthly;
    }
    // Add yield fields if provided
    if (validated.yield_type !== undefined) {
      insertData.yield_type = validated.yield_type;
    }
    if (validated.yield_rate_monthly !== undefined) {
      insertData.yield_rate_monthly = validated.yield_rate_monthly;
    }
    if (validated.cdi_percentage !== undefined) {
      insertData.cdi_percentage = validated.cdi_percentage;
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Log data creation
    await logDataModification(
      ownerId,
      'CREATE',
      'accounts',
      data.id,
      undefined,
      insertData,
      request
    ).catch((err) => console.error('[Audit] Failed to log account creation:', err));

    // Convert current_balance (NUMERIC) to balance_cents (BIGINT) for API response
    const transformedData = {
      ...data,
      balance_cents: Math.round((data.current_balance || 0) * 100),
      initial_balance_cents: Math.round((data.initial_balance || 0) * 100),
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
