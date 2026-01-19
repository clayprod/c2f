import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { receivableSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForReceivable } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { z } from 'zod';
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
      .from('receivables')
      .select('*, accounts(*), categories(*), receivable_payments(*)')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (error) throw error;

    const { data: planEntries } = await supabase
      .from('receivable_plan_entries')
      .select('entry_month, amount_cents, description')
      .eq('user_id', ownerId)
      .eq('receivable_id', id)
      .order('entry_month', { ascending: true });

    return NextResponse.json({
      data: {
        ...data,
        plan_entries: planEntries || [],
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

    // Create a partial receivable schema for PATCH request
    const partialReceivableSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório').optional(),
      description: z.string().optional(),
      debtor_name: z.string().optional(),
      principal_amount_cents: z.number().int().positive('Valor principal deve ser positivo').optional(),
      total_amount_cents: z.number().int().positive('Valor total deve ser positivo').optional(),
      received_amount_cents: z.number().int().min(0).default(0).optional(),
      interest_rate_monthly: z.number().min(0).max(100).default(0).optional(),
      interest_type: z.enum(['simple', 'compound']).default('simple').optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      status: z.enum(['pendente', 'negociada']).default('pendente').optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').optional(),
      account_id: z.string().uuid('ID da conta inválido').optional(),
      category_id: z.string().uuid('ID da categoria inválido').optional(),
      notes: z.string().optional(),
      adds_to_cash: z.boolean().default(false).optional(),
      destination_account_id: z.string().uuid('ID da conta de destino inválido').optional(),
      installment_amount_cents: z.number().int().positive().optional(),
      installment_count: z.number().int().positive().optional(),
      current_installment: z.number().int().positive().default(1).optional(),
      installment_day: z.number().int().min(1).max(31).optional(),
      payment_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
      payment_amount_cents: z.number().int().positive('Valor de pagamento deve ser positivo').optional(),
      include_in_plan: z.boolean().default(true).optional(),
      contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
      is_negotiated: z.boolean().optional(),
      plan_entries: z.array(z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
        amount_cents: z.number().int().positive('Valor deve ser positivo'),
      })).optional(),
    });

    const validated = partialReceivableSchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    
    // Get current receivable to check changes
    const { data: currentReceivable } = await supabase
      .from('receivables')
      .select('*')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (!currentReceivable) {
      return NextResponse.json(
        { error: 'Receivable not found' },
        { status: 404 }
      );
    }

    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const { plan_entries, ...receivableFields } = validated;
    const updatePayload = {
      ...receivableFields,
      include_in_plan: hasCustomPlan ? true : validated.include_in_plan,
      contribution_frequency: hasCustomPlan
        ? null
        : (validated.contribution_frequency ?? validated.payment_frequency),
      ...(validated.status ? { is_negotiated: validated.status === 'negociada' } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('receivables')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', ownerId)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    if (validated.plan_entries) {
      await supabase
        .from('receivable_plan_entries')
        .delete()
        .eq('user_id', ownerId)
        .eq('receivable_id', data.id);

      if (validated.plan_entries.length > 0) {
        const planEntries = validated.plan_entries.map((entry) => ({
          user_id: ownerId,
          receivable_id: data.id,
          category_id: data.category_id || null,
          entry_month: `${entry.month}-01`,
          amount_cents: entry.amount_cents,
          description: `Plano personalizado - ${data.name}`,
        }));

        const { error: planError } = await supabase
          .from('receivable_plan_entries')
          .upsert(planEntries, {
            onConflict: 'receivable_id,entry_month',
          });

        if (planError) {
          console.error('Error updating receivable plan entries:', planError);
        }
      }
    } else if (validated.category_id && validated.category_id !== currentReceivable.category_id) {
      await supabase
        .from('receivable_plan_entries')
        .update({ category_id: validated.category_id })
        .eq('user_id', ownerId)
        .eq('receivable_id', data.id);
    }

    // Regenerate budgets if is_negotiated and include_in_plan changed or was enabled
    const isNegotiatedChanged = validated.is_negotiated !== undefined && validated.is_negotiated !== currentReceivable.is_negotiated;
    const includeInPlanChanged = validated.include_in_plan !== undefined && validated.include_in_plan !== currentReceivable.include_in_plan;
    const statusChanged = validated.status !== undefined && validated.status !== currentReceivable.status;
    const planEntriesChanged = validated.plan_entries !== undefined;

    if (data && data.is_negotiated && data.include_in_plan && data.category_id &&
        (isNegotiatedChanged || includeInPlanChanged || statusChanged || planEntriesChanged || data.status === 'negociada')) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        
        if (data.installment_count) {
          endDate.setMonth(endDate.getMonth() + data.installment_count);
        } else {
          endDate.setMonth(endDate.getMonth() + 12);
        }
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForReceivable(
          supabase,
          ownerId,
          {
            id: data.id,
            category_id: data.category_id,
            include_in_plan: data.include_in_plan,
            is_negotiated: data.is_negotiated,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            monthly_payment_cents: data.monthly_payment_cents,
            installment_count: data.installment_count,
            installment_amount_cents: data.installment_amount_cents,
            installment_day: data.installment_day,
            total_amount_cents: data.total_amount_cents,
            received_amount_cents: data.received_amount_cents || 0,
            start_date: data.start_date,
          },
          {
            startMonth,
            endMonth,
            overwrite: true, // Overwrite when receivable is updated
          }
        );

        projectionCache.invalidateUser(ownerId);
      } catch (budgetError) {
        console.error('Error regenerating auto budgets for receivable:', budgetError);
        // Don't fail the receivable update if budget generation fails
      }
    } else if (data && (!data.is_negotiated || !data.include_in_plan || data.status !== 'negociada')) {
      // Remove auto-generated budgets if conditions no longer met
      try {
        await supabase
          .from('budgets')
          .delete()
          .eq('user_id', ownerId)
          .eq('category_id', data.category_id)
          .eq('source_type', 'receivable')
          .eq('source_id', data.id)
          .eq('is_auto_generated', true);
        
        projectionCache.invalidateUser(ownerId);
      } catch (deleteError) {
        console.error('Error deleting auto budgets for receivable:', deleteError);
      }
    }

    return NextResponse.json({ data });
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
    const { error } = await supabase
      .from('receivables')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId);

    if (error) throw error;

    return NextResponse.json({ message: 'Receivable deleted successfully' });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
