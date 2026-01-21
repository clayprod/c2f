import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { creditCardUpdateSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);

    const { data, error } = await supabase
      .from('accounts')
      .select(`
        *,
        bills:credit_card_bills(
          id,
          reference_month,
          closing_date,
          due_date,
          total_cents,
          minimum_payment_cents,
          paid_cents,
          status,
          payment_date
        )
      `)
      .eq('id', id)
      .eq('user_id', ownerId)
      .eq('type', 'credit_card')
      .single();

    if (error) throw error;

    // Convert NUMERIC to cents for calculations
    const creditLimitCents = Math.round((data.credit_limit || 0) * 100);
    const availableBalanceCents = Math.round((data.available_balance || data.credit_limit || 0) * 100);
    
    // Calculate usage
    const usedLimit = creditLimitCents - availableBalanceCents;
    const usagePercentage = creditLimitCents > 0
      ? Math.round((usedLimit / creditLimitCents) * 100)
      : 0;

    return NextResponse.json({
      data: {
        ...data,
        balance_cents: Math.round((data.current_balance || 0) * 100),
        credit_limit_cents: creditLimitCents,
        available_limit_cents: availableBalanceCents,
        used_limit_cents: usedLimit,
        usage_percentage: usagePercentage,
        expiration_date: data.expiration_date || null,
      }
    });
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const body = await request.json();
    const validated = creditCardUpdateSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.institution !== undefined) updateData.institution = validated.institution;
    if (validated.last_four_digits !== undefined) {
      updateData.last_four_digits = validated.last_four_digits && validated.last_four_digits.trim() !== '' 
        ? validated.last_four_digits 
        : null;
    }
    if (validated.card_brand !== undefined) {
      updateData.card_brand = validated.card_brand || null;
    }
    if (validated.credit_limit_cents !== undefined) {
      // Convert cents to NUMERIC for database
      updateData.credit_limit = validated.credit_limit_cents / 100;
      // Recalculate available limit
      const { data: currentCard } = await supabase
        .from('accounts')
        .select('credit_limit, available_balance')
        .eq('id', id)
        .single();

      if (currentCard) {
        const creditLimitCents = Math.round((currentCard.credit_limit || 0) * 100);
        const availableBalanceCents = Math.round((currentCard.available_balance || 0) * 100);
        const usedLimit = creditLimitCents - availableBalanceCents;
        const newAvailableLimitCents = Math.max(0, validated.credit_limit_cents - usedLimit);
        updateData.available_balance = newAvailableLimitCents / 100;
      }
    }
    if (validated.closing_day !== undefined) updateData.closing_day = validated.closing_day;
    if (validated.due_day !== undefined) updateData.due_day = validated.due_day;
    if (validated.expiration_date !== undefined) {
      updateData.expiration_date = validated.expiration_date && validated.expiration_date.trim() !== '' 
        ? validated.expiration_date 
        : null;
    }
    // Note: interest_rate_monthly and interest_rate_annual columns don't exist in accounts table, so we skip them
    if (validated.color !== undefined) updateData.color = validated.color;
    if (validated.assigned_to !== undefined) updateData.assigned_to = validated.assigned_to || null;

    // Handle default card
    if (validated.is_default === true) {
      await supabase
        .from('accounts')
        .update({ is_default: false })
        .eq('user_id', ownerId)
        .eq('type', 'credit_card');
      updateData.is_default = true;
    } else if (validated.is_default === false) {
      updateData.is_default = false;
    }

    const { data, error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', ownerId)
      .eq('type', 'credit_card')
      .select()
      .single();

    if (error) throw error;

    // Convert NUMERIC to cents for API response
    const responseData = {
      ...data,
      balance_cents: Math.round((data.current_balance || 0) * 100),
      credit_limit_cents: Math.round((data.credit_limit || 0) * 100),
      available_limit_cents: Math.round((data.available_balance || 0) * 100),
      expiration_date: data.expiration_date || null,
    };

    return NextResponse.json({ data: responseData });
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);

    // Check if card has transactions
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id)
      .eq('user_id', ownerId);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir um cartão que possui transações' },
        { status: 400 }
      );
    }

    // Delete associated bills first
    await supabase
      .from('credit_card_bills')
      .delete()
      .eq('account_id', id)
      .eq('user_id', ownerId);

    // Delete the card
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId)
      .eq('type', 'credit_card');

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
