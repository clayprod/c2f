import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { goalSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { calculateMonthlyContribution } from '@/services/goals/contributionCalculator';
import { generateAutoBudgetsForGoal } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('goals')
      .select('*, accounts(*), categories(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Recalculate current amounts from transactions for each goal
    if (data && data.length > 0) {
      for (const goal of data) {
        if (goal.category_id) {
          // Sum all transactions with this category
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('category_id', goal.category_id);

          if (transactions && transactions.length > 0) {
            // Expenses (negative) = contributions (increase amount)
            // Income (positive) = withdrawals (decrease amount)
            const contributions = transactions
              .filter((tx: any) => tx.amount < 0)
              .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount * 100), 0);
            
            const withdrawals = transactions
              .filter((tx: any) => tx.amount > 0)
              .reduce((sum: number, tx: any) => sum + (tx.amount * 100), 0);

            const calculatedAmount = contributions - withdrawals;
            
            // Update goal if current amount differs
            if (calculatedAmount !== (goal.current_amount_cents || 0)) {
              await supabase
                .from('goals')
                .update({ current_amount_cents: calculatedAmount })
                .eq('id', goal.id);
              
              goal.current_amount_cents = calculatedAmount;
            }
          }
        }
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = goalSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this goal (using goal name directly)
    const categoryName = validated.name.toUpperCase();
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: categoryName,
        type: 'expense', // Contributions are expenses, but can also be used for income (withdrawals)
        icon: validated.icon || '🎯',
        color: validated.color || '#32CD32',
        source_type: 'goal',
      })
      .select()
      .single();

    if (categoryError) {
      console.error('Error creating goal category:', categoryError);
    }

    // Calculate monthly contribution if include_in_budget is true and target_date is provided
    let monthlyContributionCents = validated.monthly_contribution_cents;
    if (validated.include_in_budget && !monthlyContributionCents && validated.target_date) {
      const calculated = calculateMonthlyContribution({
        target_amount_cents: validated.target_amount_cents,
        current_amount_cents: validated.current_amount_cents || 0,
        target_date: validated.target_date,
        start_date: validated.start_date || null,
        monthly_contribution_cents: null,
      });
      
      if (calculated && calculated > 0) {
        monthlyContributionCents = calculated;
      }
    }

    // Separate fields that may not exist yet due to missing migrations
    const contributionFields: any = {};
    const imageFields: any = {};
    const baseData: any = {
      user_id: userId,
      name: validated.name,
      description: validated.description,
      target_amount_cents: validated.target_amount_cents,
      current_amount_cents: validated.current_amount_cents || 0,
      target_date: validated.target_date,
      start_date: validated.start_date,
      status: validated.status,
      priority: validated.priority,
      icon: validated.icon,
      color: validated.color,
      account_id: validated.account_id,
      category_id: category?.id || validated.category_id,
      notes: validated.notes,
    };

    // Add contribution fields that may not exist
    if (monthlyContributionCents !== undefined) {
      contributionFields.monthly_contribution_cents = monthlyContributionCents;
    }
    if (validated.include_in_budget !== undefined) {
      contributionFields.include_in_budget = validated.include_in_budget;
    }
    if (validated.include_in_projection !== undefined) {
      contributionFields.include_in_projection = validated.include_in_projection;
    }
    if (validated.contribution_frequency !== undefined) {
      contributionFields.contribution_frequency = validated.contribution_frequency;
    }

    // Add image fields that may not exist
    if (validated.image_url !== undefined) {
      imageFields.image_url = validated.image_url;
    }
    if (validated.image_position !== undefined) {
      imageFields.image_position = validated.image_position;
    }

    // First try to insert with all fields
    const fullInsertData = { ...baseData, ...contributionFields, ...imageFields };
    let { data, error } = await supabase
      .from('goals')
      .insert(fullInsertData)
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

        // Try again with only base fields
        const result = await supabase
          .from('goals')
          .insert(baseData)
          .select('*, accounts(*), categories(*)')
          .single();

        data = result.data;
        error = result.error;

        if (error) {
          console.error('Supabase error (without new fields):', error);
          throw error;
        }
      }
    }

    if (error) throw error;

    // Generate automatic budgets if include_in_budget is true
    if (data.include_in_budget && data.status === 'active' && data.category_id) {
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
            overwrite: false,
          }
        );

        projectionCache.invalidateUser(userId);
      } catch (budgetError) {
        console.error('Error generating auto budgets for goal:', budgetError);
        // Don't fail the goal creation if budget generation fails
      }
    }

    return NextResponse.json({
      data: {
        ...data,
        category_id: category?.id,
        category_name: category?.name,
      },
      ...(missingFields.length > 0 && {
        warning: `Alguns campos não foram salvos (${missingFields.join(', ')}). Execute as migrations necessárias no Supabase Dashboard para habilitar todos os recursos.`
      })
    }, { status: 201 });
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



