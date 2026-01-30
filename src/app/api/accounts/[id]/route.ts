import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

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
      .from('accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (error) throw error;

    // Convert current_balance (NUMERIC) to balance_cents (BIGINT) for API response
    const { count: transactionsCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', params.id)
      .eq('user_id', ownerId);

    const transformedData = {
      ...data,
      balance_cents: Math.round((data.current_balance || 0) * 100),
      initial_balance_cents: Math.round((data.initial_balance || 0) * 100),
      has_transactions: (transactionsCount || 0) > 0,
    };

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const { supabase } = createClientFromRequest(request);

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    const hasInitialBalanceUpdate = body.initial_balance_cents !== undefined;
    const hasBalanceUpdate = body.balance_cents !== undefined;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.institution !== undefined) updateData.institution = body.institution;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (hasInitialBalanceUpdate) {
      updateData.initial_balance = body.initial_balance_cents / 100;
    }
    if (body.color !== undefined) updateData.color = body.color;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;
    if (body.overdraft_limit_cents !== undefined) updateData.overdraft_limit_cents = body.overdraft_limit_cents;
    if (body.overdraft_interest_rate_monthly !== undefined) updateData.overdraft_interest_rate_monthly = body.overdraft_interest_rate_monthly;
    if (body.yield_type !== undefined) updateData.yield_type = body.yield_type;
    if (body.yield_rate_monthly !== undefined) updateData.yield_rate_monthly = body.yield_rate_monthly;
    if (body.cdi_percentage !== undefined) updateData.cdi_percentage = body.cdi_percentage;

    let transactionsCount: number | null = null;
    if (hasBalanceUpdate || hasInitialBalanceUpdate) {
      const countResponse = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', params.id)
        .eq('user_id', ownerId);
      transactionsCount = countResponse.count || 0;
    }

    if (hasBalanceUpdate && !hasInitialBalanceUpdate && (transactionsCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Não é possível editar o saldo atual quando há transações. Edite o saldo inicial ou ajuste as transações.' },
        { status: 400 }
      );
    }

    if (hasInitialBalanceUpdate) {
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('account_id', params.id)
        .eq('user_id', ownerId);

      if (txError) throw txError;

      const totalTransactionsAmount = (transactions || []).reduce(
        (sum: number, tx: { amount: any }) => sum + (typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0),
        0
      );

      updateData.current_balance = updateData.initial_balance + totalTransactionsAmount;
    } else if (hasBalanceUpdate) {
      updateData.current_balance = body.balance_cents / 100;
      updateData.initial_balance = body.balance_cents / 100;
    }

    const { data, error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (error) throw error;

    // Convert current_balance (NUMERIC) to balance_cents (BIGINT) for API response
    if (transactionsCount === null) {
      const countResponse = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', params.id)
        .eq('user_id', ownerId);
      transactionsCount = countResponse.count || 0;
    }

    const transformedData = {
      ...data,
      balance_cents: Math.round((data.current_balance || 0) * 100),
      initial_balance_cents: Math.round((data.initial_balance || 0) * 100),
      has_transactions: (transactionsCount || 0) > 0,
    };

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function DELETE(
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

    // Check if account has transactions
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', params.id)
      .eq('user_id', ownerId);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir uma conta que possui transações' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', params.id)
      .eq('user_id', ownerId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
