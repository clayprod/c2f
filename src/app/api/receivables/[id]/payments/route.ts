import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { receivablePaymentSchema } from '@/lib/validation/schemas';
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
      .from('receivable_payments')
      .select('*, transactions(*)')
      .eq('receivable_id', params.id)
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
    const validated = receivablePaymentSchema.parse({
      ...body,
      receivable_id: params.id,
    });

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    // Get receivable to get category_id and account_id
    const { data: receivable } = await supabase
      .from('receivables')
      .select('category_id, account_id, name')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (!receivable) {
      return NextResponse.json(
        { error: 'Receivable not found' },
        { status: 404 }
      );
    }

    // Create income transaction if category_id exists
    let transactionId = validated.transaction_id;
    if (!transactionId && receivable.category_id && receivable.account_id) {
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: ownerId,
          account_id: receivable.account_id,
          category_id: receivable.category_id,
          posted_at: validated.payment_date,
          description: `Recebimento: ${receivable.name}`,
          amount_cents: validated.amount_cents, // Positive = income
          currency: 'BRL',
          source: 'manual',
          notes: validated.notes || `Pagamento recebido do recebível`,
        })
        .select()
        .single();

      if (txError) {
        console.error('Error creating income transaction:', txError);
      } else {
        transactionId = transaction?.id;

        // Update account balance
        const { data: account } = await supabase
          .from('accounts')
          .select('current_balance')
          .eq('id', receivable.account_id)
          .single();

        if (account) {
          const currentBalance = parseFloat(account.current_balance || 0);
          const newBalance = currentBalance + (validated.amount_cents / 100);
          await supabase
            .from('accounts')
            .update({
              current_balance: newBalance,
            })
            .eq('id', receivable.account_id);
        }
      }
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('receivable_payments')
      .insert({
        ...validated,
        receivable_id: params.id,
        user_id: ownerId,
        amount_cents: validated.amount_cents,
        transaction_id: transactionId || null,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update receivable's received amount
    const { data: currentReceivable } = await supabase
      .from('receivables')
      .select('received_amount_cents')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (currentReceivable) {
      const currentReceived = typeof currentReceivable.received_amount_cents === 'string' 
        ? parseInt(currentReceivable.received_amount_cents) 
        : currentReceivable.received_amount_cents;
      const newReceivedAmount = currentReceived + validated.amount_cents;
      await supabase
        .from('receivables')
        .update({
          received_amount_cents: newReceivedAmount,
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
