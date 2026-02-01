import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { investmentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForInvestment } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { z } from 'zod';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

const missingColumnRegex = /column "?([^"]+)"?/i;

const getMissingColumn = (error: any) => {
  if (!error || error.code !== '42703' || typeof error.message !== 'string') {
    return null;
  }

  const match = error.message.match(missingColumnRegex);
  return match?.[1] ?? null;
};

const applyMissingColumnFallback = (payload: Record<string, any>, column: string) => {
  const nextPayload = { ...payload };

  if (column === 'include_in_plan') {
    nextPayload.include_in_budget = nextPayload.include_in_plan;
    delete nextPayload.include_in_plan;
    return nextPayload;
  }

  if (column === 'include_in_budget') {
    delete nextPayload.include_in_budget;
    return nextPayload;
  }

  const optionalColumns = [
    'category_id',
    'contribution_frequency',
    'contribution_count',
    'monthly_contribution_cents',
    'contribution_day',
    'start_date',
    'assigned_to',
    'institution_domain',
    'institution_brand_id',
    'institution_primary_color',
  ];

  if (optionalColumns.includes(column)) {
    delete nextPayload[column];
    return nextPayload;
  }

  return null;
};

const normalizeIncludeInPlan = (investment: any, fallback?: boolean) => {
  const includeInPlan = investment?.include_in_plan ?? investment?.include_in_budget ?? fallback ?? false;
  return {
    ...investment,
    include_in_plan: includeInPlan,
  };
};

const shouldDropCategorySelect = (error: any) => {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  if (error.code === '42703') {
    const missingColumn = getMissingColumn(error);
    if (missingColumn === 'category_id') {
      return true;
    }
  }

  return message.includes('categories') || message.includes('category_id');
};

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
    const { data, error }: { data: any; error: any } = await supabase
      .from('investments')
      .select('*, accounts(*), investment_transactions(*)')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (error) throw error;

    const { data: planEntries } = await supabase
      .from('investment_plan_entries')
      .select('entry_month, amount_cents, description')
      .eq('user_id', ownerId)
      .eq('investment_id', params.id)
      .order('entry_month', { ascending: true });

    const normalizedData = normalizeIncludeInPlan(data);

    return NextResponse.json({
      data: {
        ...normalizedData,
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
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();

    // Create a partial investment schema for PATCH request
    const partialInvestmentSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório').optional(),
      type: z.enum(['stocks', 'bonds', 'funds', 'crypto', 'real_estate', 'other']).optional(),
      institution: z.string().optional(),
      institution_domain: z.string().optional(),
      institution_brand_id: z.string().optional(),
      institution_primary_color: z.string().optional(),
      account_id: z.string().uuid('ID da conta inválido').optional(),
      initial_investment_cents: z.number().int().positive('Investimento inicial deve ser positivo').optional(),
      current_value_cents: z.number().int().min(0).optional(),
      purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
      quantity: z.number().positive().optional(),
      unit_price_cents: z.number().int().positive().optional(),
      currency: z.string().default('BRL').optional(),
      status: z.enum(['active', 'sold', 'matured']).default('active').optional(),
      notes: z.string().optional(),
      monthly_contribution_cents: z.number().int().positive().optional(),
      contribution_day: z.number().int().min(1).max(31).optional(),
      include_in_plan: z.boolean().default(true).optional(),
      contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
      contribution_count: z.number().int().positive().optional(),
      assigned_to: z.union([
        z.string().uuid('ID do responsável inválido'),
        z.literal(''),
        z.null()
      ]).optional().transform(val => val === '' || val === null ? undefined : val),
      plan_entries: z.array(z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
        amount_cents: z.number().int().positive('Valor deve ser positivo'),
      })).optional(),
    });

    const validated = partialInvestmentSchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    
    // Get current investment to check changes
    const { data: currentInvestment } = await supabase
      .from('investments')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (!currentInvestment) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    const currentIncludeInPlan =
      currentInvestment.include_in_plan ?? currentInvestment.include_in_budget ?? false;
    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const { plan_entries, assigned_to, ...investmentFields } = validated;
    const updatePayload: any = {
      ...investmentFields,
      include_in_plan: hasCustomPlan ? true : validated.include_in_plan,
      contribution_frequency: hasCustomPlan ? null : validated.contribution_frequency,
      contribution_count: hasCustomPlan ? null : validated.contribution_count,
      updated_at: new Date().toISOString(),
    };

    // Only include assigned_to if it was provided in the request
    if ('assigned_to' in validated) {
      updatePayload.assigned_to = assigned_to || null;
    }

    let selectColumns = '*, accounts(*), categories(*)';
    let { data, error } = await supabase
      .from('investments')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .select(selectColumns)
      .single();

    if (error) {
      let fallbackError: any = error;
      let fallbackPayload = updatePayload;
      const attemptedColumns = new Set<string>();

      while (fallbackError && fallbackError.code === '42703') {
        const missingColumn = getMissingColumn(fallbackError);
        const shouldDropCategories = shouldDropCategorySelect(fallbackError) && selectColumns.includes('categories');
        const nextPayload = missingColumn
          ? applyMissingColumnFallback(fallbackPayload, missingColumn)
          : null;

        if (!nextPayload && !shouldDropCategories) {
          break;
        }

        if (nextPayload && missingColumn) {
          attemptedColumns.add(missingColumn);
          fallbackPayload = nextPayload;
        } else if (nextPayload) {
          fallbackPayload = nextPayload;
        }

        if (shouldDropCategories) {
          selectColumns = '*, accounts(*)';
        }

        const retryResult = await supabase
          .from('investments')
          .update(fallbackPayload)
          .eq('id', params.id)
          .eq('user_id', ownerId)
          .select(selectColumns)
          .single();

        data = retryResult.data;
        error = retryResult.error;
        fallbackError = retryResult.error;

        if (!retryResult.error) {
          break;
        }
      }
    }

    if (error) throw error;

    const normalizedData = normalizeIncludeInPlan(data, currentIncludeInPlan);

    if (validated.plan_entries) {
      await supabase
        .from('investment_plan_entries')
        .delete()
        .eq('user_id', ownerId)
        .eq('investment_id', normalizedData.id);

      if (validated.plan_entries.length > 0) {
        const planEntries = validated.plan_entries.map((entry) => ({
          user_id: ownerId,
          investment_id: normalizedData.id,
          category_id: normalizedData.category_id || null,
          entry_month: `${entry.month}-01`,
          amount_cents: entry.amount_cents,
          description: `Plano personalizado - ${normalizedData.name}`,
        }));

        const { error: planError } = await supabase
          .from('investment_plan_entries')
          .upsert(planEntries, {
            onConflict: 'investment_id,entry_month',
          });

        if (planError) {
          console.error('Error updating investment plan entries:', planError);
        }
      }
    }

    // Regenerate budgets if include_in_plan is true and investment is active
    const nextIncludeInPlan = hasCustomPlan
      ? true
      : (validated.include_in_plan ?? currentIncludeInPlan);
    const includeInPlanChanged =
      validated.include_in_plan !== undefined && nextIncludeInPlan !== currentIncludeInPlan;
    const statusChanged = validated.status !== undefined && validated.status !== currentInvestment.status;
    const planEntriesChanged = validated.plan_entries !== undefined;

    if (normalizedData && normalizedData.include_in_plan && normalizedData.status === 'active' && normalizedData.category_id && 
        (includeInPlanChanged || statusChanged || planEntriesChanged)) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 12); // Next 12 months
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForInvestment(
          supabase,
          ownerId,
          {
            id: normalizedData.id,
            category_id: normalizedData.category_id,
            include_in_plan: normalizedData.include_in_plan,
            status: normalizedData.status,
            contribution_frequency: normalizedData.contribution_frequency,
            contribution_count: normalizedData.contribution_count,
            monthly_contribution_cents: normalizedData.monthly_contribution_cents,
            purchase_date: normalizedData.purchase_date,
          },
          {
            startMonth,
            endMonth,
            overwrite: true, // Overwrite when investment is updated
          }
        );

        projectionCache.invalidateUser(ownerId);
      } catch (budgetError) {
        console.error('Error regenerating auto budgets for investment:', budgetError);
        // Don't fail the investment update if budget generation fails
      }
    } else if (normalizedData && (!normalizedData.include_in_plan || normalizedData.status !== 'active')) {
      // Remove auto-generated budgets if conditions no longer met
      try {
        await supabase
          .from('budgets')
          .delete()
          .eq('user_id', ownerId)
          .eq('category_id', normalizedData.category_id)
          .eq('source_type', 'investment')
          .eq('source_id', normalizedData.id)
          .eq('is_auto_generated', true);
        
        projectionCache.invalidateUser(ownerId);
      } catch (deleteError) {
        console.error('Error deleting auto budgets for investment:', deleteError);
      }
    }

    return NextResponse.json({ data: normalizedData });
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

    const { supabase } = createClientFromRequest(request);
    
    // Delete related budgets first
    await supabase
      .from('budgets')
      .delete()
      .eq('user_id', ownerId)
      .eq('source_type', 'investment')
      .eq('source_id', params.id);

    // Delete investment plan entries
    await supabase
      .from('investment_plan_entries')
      .delete()
      .eq('user_id', ownerId)
      .eq('investment_id', params.id);

    // Delete the investment
    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', params.id)
      .eq('user_id', ownerId);

    if (error) throw error;

    // Invalidate projection cache
    projectionCache.invalidateUser(ownerId);

    return NextResponse.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
