import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { investmentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForInvestment } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { z } from 'zod';
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

    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const { plan_entries, ...investmentFields } = validated;
    const updatePayload = {
      ...investmentFields,
      include_in_plan: hasCustomPlan ? true : validated.include_in_plan,
      contribution_frequency: hasCustomPlan ? null : validated.contribution_frequency,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('investments')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    if (validated.plan_entries) {
      await supabase
        .from('investment_plan_entries')
        .delete()
        .eq('user_id', ownerId)
        .eq('investment_id', data.id);

      if (validated.plan_entries.length > 0) {
        const planEntries = validated.plan_entries.map((entry) => ({
          user_id: ownerId,
          investment_id: data.id,
          category_id: data.category_id || null,
          entry_month: `${entry.month}-01`,
          amount_cents: entry.amount_cents,
          description: `Plano personalizado - ${data.name}`,
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
    const includeInPlanChanged = validated.include_in_plan !== undefined && validated.include_in_plan !== currentInvestment.include_in_plan;
    const statusChanged = validated.status !== undefined && validated.status !== currentInvestment.status;
    const planEntriesChanged = validated.plan_entries !== undefined;

    if (data && data.include_in_plan && data.status === 'active' && data.category_id && 
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
            id: data.id,
            category_id: data.category_id,
            include_in_plan: data.include_in_plan,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            monthly_contribution_cents: data.monthly_contribution_cents,
            purchase_date: data.purchase_date,
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
    } else if (data && (!data.include_in_plan || data.status !== 'active')) {
      // Remove auto-generated budgets if conditions no longer met
      try {
        await supabase
          .from('budgets')
          .delete()
          .eq('user_id', ownerId)
          .eq('category_id', data.category_id)
          .eq('source_type', 'investment')
          .eq('source_id', data.id)
          .eq('is_auto_generated', true);
        
        projectionCache.invalidateUser(ownerId);
      } catch (deleteError) {
        console.error('Error deleting auto budgets for investment:', deleteError);
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
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { supabase } = createClientFromRequest(request);
    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', params.id)
      .eq('user_id', ownerId);

    if (error) throw error;

    return NextResponse.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}




