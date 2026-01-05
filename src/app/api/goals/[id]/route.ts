import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { goalSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';
import { ZodError } from 'zod';
import { calculateMonthlyContribution } from '@/services/goals/contributionCalculator';
import { generateAutoBudgetsForGoal } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('goals')
      .select('*, accounts(*), categories(*), goal_contributions(*)')
      .eq('id', id)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('PATCH body received:', JSON.stringify(body, null, 2));
    // For PATCH updates, we validate with a partial schema
    // Extract the base object schema before refine() and make it partial
    const goalUpdateSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório').optional(),
      description: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.string().optional()
      ),
      target_amount_cents: z.number().int().positive('Meta deve ser positiva').optional(),
      current_amount_cents: z.number().int().min(0).optional(),
      target_date: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional()
      ),
      start_date: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional()
      ),
      status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      image_url: z.string().url('URL da imagem inválida').optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
      image_position: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.union([
          z.enum(['top left', 'top center', 'top right', 'center left', 'center', 'center right', 'bottom left', 'bottom center', 'bottom right']),
          z.string().regex(/^\d+%\s+\d+%$/, 'Formato de posição inválido (use "50% 50%")')
        ]).optional()
      ),
      account_id: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.string().uuid('ID da conta inválido').optional()
      ),
      category_id: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.string().uuid('ID da categoria inválido').optional()
      ),
      notes: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.string().optional()
      ),
      monthly_contribution_cents: z.number().int().positive().optional(),
      include_in_projection: z.boolean().optional(),
      include_in_budget: z.boolean().optional(),
      contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
    });
    let validated;
    try {
      validated = goalUpdateSchema.parse(body);
      console.log('Validated data:', JSON.stringify(validated, null, 2));
    } catch (validationError) {
      console.error('Validation error:', validationError);
      throw validationError;
    }

    const { id } = await params;
    console.log('Updating goal with id:', id, 'for user:', userId);
    const { supabase } = createClientFromRequest(request);
    
    // Get current goal to check if we need to recalculate
    const { data: currentGoal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!currentGoal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    // Calculate monthly contribution if include_in_budget is true and target_date changed
    const targetDateChanged = validated.target_date && validated.target_date !== currentGoal.target_date;
    const targetAmountChanged = validated.target_amount_cents && validated.target_amount_cents !== currentGoal.target_amount_cents;
    const includeInBudgetChanged = validated.include_in_budget !== undefined && validated.include_in_budget !== currentGoal.include_in_budget;
    
    let monthlyContributionCents = validated.monthly_contribution_cents;
    if (validated.include_in_budget !== false && !monthlyContributionCents) {
      const targetDate = validated.target_date || currentGoal.target_date;
      const targetAmount = validated.target_amount_cents || currentGoal.target_amount_cents;
      const currentAmount = validated.current_amount_cents !== undefined ? validated.current_amount_cents : currentGoal.current_amount_cents;
      
      if (targetDate && targetAmount) {
        const calculated = calculateMonthlyContribution({
          target_amount_cents: targetAmount,
          current_amount_cents: currentAmount || 0,
          target_date: targetDate,
          start_date: validated.start_date || currentGoal.start_date || null,
          monthly_contribution_cents: currentGoal.monthly_contribution_cents,
        });
        
        if (calculated && calculated > 0) {
          monthlyContributionCents = calculated;
        }
      }
    }
    
    // Remove undefined values from update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Separate fields that may not exist yet due to missing migrations
    const imageFields: any = {};
    const contributionFields: any = {};
    const regularFields: any = {};

    // Add monthly_contribution_cents to contribution fields
    if (monthlyContributionCents !== undefined) {
      contributionFields.monthly_contribution_cents = monthlyContributionCents;
    }

    Object.keys(validated).forEach((key) => {
      const value = validated[key as keyof typeof validated];
      if (value !== undefined && value !== null) {
        if (key === 'image_url' || key === 'image_position') {
          imageFields[key] = value;
        } else if (key === 'include_in_budget' || key === 'include_in_projection' || key === 'contribution_frequency') {
          contributionFields[key] = value;
        } else {
          regularFields[key] = value;
        }
      }
    });

    // First try to update with all fields
    const fullUpdateData = { ...updateData, ...regularFields, ...contributionFields, ...imageFields };
    console.log('Update data:', JSON.stringify(fullUpdateData, null, 2));

    let { data, error } = await supabase
      .from('goals')
      .update(fullUpdateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, accounts(*), categories(*)')
      .single();

    // Track what fields failed due to missing columns
    let missingFields: string[] = [];

    // If error is about missing columns, try again without those fields
    if (error && (error as any).code === 'PGRST204') {
      const errorMessage = (error as any).message || '';
      console.warn('⚠️ Erro PGRST204 detectado:', errorMessage);

      // Check which fields are missing
      const contributionFieldNames = Object.keys(contributionFields);
      const imageFieldNames = Object.keys(imageFields);

      const hasContributionError = contributionFieldNames.some(field => errorMessage.includes(field));
      const hasImageError = imageFieldNames.some(field => errorMessage.includes(field));

      if (hasContributionError || hasImageError) {
        if (hasContributionError) {
          missingFields.push(...contributionFieldNames);
          console.warn('⚠️ Colunas de contribuição não existem:', contributionFieldNames.join(', '));
        }
        if (hasImageError) {
          missingFields.push(...imageFieldNames);
          console.warn('⚠️ Colunas de imagem não existem:', imageFieldNames.join(', '));
        }
        console.warn('📋 Execute a migration 008_budget_automatic_contributions.sql e 013_add_goals_image_url.sql no Supabase Dashboard');

        // Try again with only regular fields
        const updateWithoutNewFields = { ...updateData, ...regularFields };
        const result = await supabase
          .from('goals')
          .update(updateWithoutNewFields)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*, accounts(*), categories(*)')
          .single();

        data = result.data;
        error = result.error;

        if (error) {
          console.error('Supabase error (without new fields):', error);
          throw error;
        }

        // Return a warning in the response
        return NextResponse.json({
          data,
          warning: `Alguns campos não foram salvos (${missingFields.join(', ')}). Execute as migrations necessárias no Supabase Dashboard para habilitar todos os recursos.`
        });
      }
    }

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Regenerate budgets if include_in_budget is true and goal is active
    if (data && data.include_in_budget && data.status === 'active' && data.category_id) {
      // Regenerate if include_in_budget was just enabled, or if target_date/amount changed
      if (includeInBudgetChanged || targetDateChanged || targetAmountChanged) {
        try {
          const today = new Date();
          const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const endDate = new Date(today);
          endDate.setMonth(endDate.getMonth() + 12); // Next 12 months
          const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

          await generateAutoBudgetsForGoal(
            supabase,
            userId,
            {
              id: data.id,
              category_id: data.category_id,
              include_in_budget: data.include_in_budget,
              status: data.status,
              contribution_frequency: data.contribution_frequency,
              monthly_contribution_cents: data.monthly_contribution_cents,
              target_amount_cents: data.target_amount_cents,
              current_amount_cents: data.current_amount_cents || 0,
              target_date: data.target_date,
              start_date: data.start_date,
            },
            {
              startMonth,
              endMonth,
              overwrite: true, // Overwrite existing budgets when goal is updated
            }
          );

          projectionCache.invalidateUser(userId);
        } catch (budgetError) {
          console.error('Error regenerating auto budgets for goal:', budgetError);
          // Don't fail the goal update if budget generation fails
        }
      }
    } else if (data && (!data.include_in_budget || data.status !== 'active')) {
      // Remove auto-generated budgets if include_in_budget is false or status is not active
      try {
        await supabase
          .from('budgets')
          .delete()
          .eq('user_id', userId)
          .eq('category_id', data.category_id)
          .eq('source_type', 'goal')
          .eq('source_id', data.id)
          .eq('is_auto_generated', true);
        
        projectionCache.invalidateUser(userId);
      } catch (deleteError) {
        console.error('Error deleting auto budgets for goal:', deleteError);
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.errors.map(e => ({ path: e.path, message: e.message }))
        },
        { status: 400 }
      );
    }
    console.error('Error updating goal:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Try to get more details from Supabase errors
    let errorDetails: any = undefined;
    if (error && typeof error === 'object' && 'code' in error) {
      errorDetails = {
        code: (error as any).code,
        message: (error as any).message,
        details: (error as any).details,
        hint: (error as any).hint,
      };
    }
    
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { 
        error: errorResponse.error,
        message: error instanceof Error ? error.message : undefined,
        details: errorDetails || (process.env.NODE_ENV === 'development' ? String(error) : undefined)
      },
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

    const { id } = await params;
    const { supabase } = createClientFromRequest(request);
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}




