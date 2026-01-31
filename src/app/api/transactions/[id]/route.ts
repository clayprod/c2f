import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { transactionSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { projectionCache } from '@/services/projections/cache';
import { recalculateCreditCardBalance } from '@/lib/utils/creditCardBalance';

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

    const { id } = params;
    const { supabase } = createClientFromRequest(request);
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*, accounts(*), categories(*)')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Convert amount (NUMERIC) to amount_cents (BIGINT) for API response
    const transformedData = {
      ...data,
      amount_cents: Math.round((data.amount || 0) * 100),
    };

    projectionCache.invalidateUser(ownerId);

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

    const { id } = params;
    const body = await request.json();

    // Create a partial transaction schema for PATCH request
    const partialTransactionSchema = z.object({
      account_id: z.string().uuid('ID da conta inválido').optional(),
      category_id: z.string().uuid('ID da categoria inválido').optional().or(z.literal('')).transform(val => val || undefined).optional(),
      posted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      description: z.string().min(1, 'Descrição é obrigatória').optional(),
      amount_cents: z.number().int('Valor deve ser em centavos (número inteiro)').optional(),
      currency: z.string().default('BRL').optional(),
      notes: z.string().optional().or(z.literal('')).transform(val => val || undefined).optional(),
      type: z.enum(['income', 'expense']).optional(),
      source: z.enum(['manual', 'pluggy', 'import']).default('manual').optional(),
      provider_tx_id: z.string().optional(),
      recurrence_rule: z.string().optional().or(z.literal('')).transform(val => val || undefined).optional(),
      contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
      installment_number: z.number().int().positive().optional(),
      installment_total: z.number().int().positive().optional(),
    });

    const validated = partialTransactionSchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    
    // Verify ownership
    const { data: existing } = await supabase
      .from('transactions')
      .select('id, source, provider_tx_id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check if this transaction is a credit card bill item (payment)
    // Bill items should not have their account_id changed
    if (validated.account_id !== undefined) {
      const { data: billItem } = await supabase
        .from('credit_card_bill_items')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (billItem) {
        return NextResponse.json(
          { error: 'Não é possível alterar a conta de um item de fatura de cartão de crédito' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (validated.account_id !== undefined) updateData.account_id = validated.account_id;
    if (validated.category_id !== undefined) updateData.category_id = validated.category_id;
    if (validated.posted_at !== undefined) updateData.posted_at = validated.posted_at;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.amount_cents !== undefined) {
      let amount = validated.amount_cents / 100;
      if (validated.type === 'expense' && amount > 0) {
        amount = -amount;
      } else if (validated.type === 'income' && amount < 0) {
        amount = Math.abs(amount);
      }
      updateData.amount = amount;
    }
    if (validated.currency !== undefined) updateData.currency = validated.currency;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    // Extended fields
    if (validated.recurrence_rule !== undefined) updateData.recurrence_rule = validated.recurrence_rule;
    if (validated.installment_number !== undefined) updateData.installment_number = validated.installment_number;
    if (validated.installment_total !== undefined) updateData.installment_total = validated.installment_total;

    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', ownerId)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    // Convert amount (NUMERIC) to amount_cents (BIGINT) for API response
    const transformedData = {
      ...data,
      amount_cents: Math.round((data.amount || 0) * 100),
    };

    return NextResponse.json({ data: transformedData });
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
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { id } = params;
    const { supabase } = createClientFromRequest(request);
    
    // Verify ownership and get transaction details
    const { data: existing } = await supabase
      .from('transactions')
      .select('id, category_id, amount, description')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check if this is a credit card bill payment (has category_id matching a credit card)
    let creditCardId: string | null = null;
    let paymentAmountCents: number = 0;
    
    if (existing.category_id) {
      const { data: creditCard } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', ownerId)
        .eq('type', 'credit_card')
        .eq('category_id', existing.category_id)
        .single();

      if (creditCard) {
        creditCardId = creditCard.id;
        paymentAmountCents = Math.abs(Math.round((existing.amount || 0) * 100));
      }
    }

    // If it's a credit card payment, reverse the payment
    if (creditCardId && paymentAmountCents > 0) {
      // Find bills that were paid by this transaction
      const { data: bills } = await supabase
        .from('credit_card_bills')
        .select('id, paid_cents, status')
        .eq('account_id', creditCardId)
        .in('status', ['paid', 'partial'])
        .order('due_date', { ascending: false });

      if (bills && bills.length > 0) {
        let remainingToReverse = paymentAmountCents;

        for (const bill of bills) {
          if (remainingToReverse <= 0) break;

          const paidCents = bill.paid_cents || 0;
          const reverseAmount = Math.min(remainingToReverse, paidCents);
          
          if (reverseAmount > 0) {
            const newPaidCents = paidCents - reverseAmount;
            const newStatus = newPaidCents === 0 ? 'open' : 'partial';

            await supabase
              .from('credit_card_bills')
              .update({
                paid_cents: newPaidCents,
                status: newStatus,
              })
              .eq('id', bill.id);

            remainingToReverse -= reverseAmount;
          }
        }

        // Recalculate credit card balance
        await recalculateCreditCardBalance(supabase, creditCardId);
      }
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId);

    if (error) throw error;

    if ((existing as any)?.source === 'pluggy') {
      const { error: pluggyError } = await supabase
        .from('pluggy_transactions')
        .update({
          imported_at: null,
          imported_transaction_id: null,
        })
        .eq('user_id', ownerId)
        .eq('imported_transaction_id', id);

      if (pluggyError) throw pluggyError;
    }

    projectionCache.invalidateUser(ownerId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}



