import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { investmentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForInvestment } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('investments')
      .select('*, accounts(*), investment_transactions(*)')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      include_in_budget: z.boolean().default(false).optional(),
      contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
    });

    const validated = partialInvestmentSchema.parse(body);

    const { supabase } = createClientFromRequest(request);
    
    // Get current investment to check changes
    const { data: currentInvestment } = await supabase
      .from('investments')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (!currentInvestment) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('investments')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', userId)
      .select('*, accounts(*), categories(*)')
      .single();

    if (error) throw error;

    // Regenerate budgets if include_in_budget is true and investment is active
    const includeInBudgetChanged = validated.include_in_budget !== undefined && validated.include_in_budget !== currentInvestment.include_in_budget;
    const statusChanged = validated.status !== undefined && validated.status !== currentInvestment.status;

    if (data && data.include_in_budget && data.status === 'active' && data.category_id && 
        data.contribution_frequency && data.monthly_contribution_cents &&
        (includeInBudgetChanged || statusChanged)) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 12); // Next 12 months
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForInvestment(
          supabase,
          userId,
          {
            id: data.id,
            category_id: data.category_id,
            include_in_budget: data.include_in_budget,
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

        projectionCache.invalidateUser(userId);
      } catch (budgetError) {
        console.error('Error regenerating auto budgets for investment:', budgetError);
        // Don't fail the investment update if budget generation fails
      }
    } else if (data && (!data.include_in_budget || data.status !== 'active')) {
      // Remove auto-generated budgets if conditions no longer met
      try {
        await supabase
          .from('budgets')
          .delete()
          .eq('user_id', userId)
          .eq('category_id', data.category_id)
          .eq('source_type', 'investment')
          .eq('source_id', data.id)
          .eq('is_auto_generated', true);
        
        projectionCache.invalidateUser(userId);
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

    const { supabase } = createClientFromRequest(request);
    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', params.id)
      .eq('user_id', userId);

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




