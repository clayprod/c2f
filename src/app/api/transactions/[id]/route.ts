import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { transactionSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
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
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
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
    
    // Verify ownership
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId);

    if (error) throw error;

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



