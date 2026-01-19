import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { debtPaymentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';

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
      .from('debt_payments')
      .select('*, transactions(*)')
      .eq('debt_id', params.id)
      .eq('user_id', ownerId)
      .order('payment_date', { ascending: false });

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
    const validated = debtPaymentSchema.parse({
      ...body,
      debt_id: params.id,
    });

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    // Create payment
    const { data: payment, error: paymentError } = await supabase
      .from('debt_payments')
      .insert({
        ...validated,
        user_id: ownerId,
        amount_cents: validated.amount_cents,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update debt's paid amount
    const { data: debt } = await supabase
      .from('debts')
      .select('paid_amount_cents')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (debt) {
      const currentPaid = typeof debt.paid_amount_cents === 'string' 
        ? parseInt(debt.paid_amount_cents) 
        : debt.paid_amount_cents;
      const newPaidAmount = currentPaid + validated.amount_cents;
      await supabase
        .from('debts')
        .update({
          paid_amount_cents: newPaidAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('user_id', ownerId);
    }

    return NextResponse.json({ data: payment }, { status: 201 });
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
