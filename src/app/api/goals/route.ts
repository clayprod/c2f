import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserId } from '@/lib/auth';
import { goalSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { calculateMonthlyContribution } from '@/services/goals/contributionCalculator';
import { generateAutoBudgetsForGoal } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const { supabase } = createClientFromRequest(request);
    let query = supabase
      .from('goals')
      .select('*, accounts(*), categories(*)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Fetch assigned_to profiles separately using admin client (bypasses RLS)
    const assignedToIds = [...new Set((data || [])
      .map((goal: any) => goal.assigned_to)
      .filter((id: string | null) => id !== null))] as string[];

    let profilesMap: Record<string, any> = {};
    if (assignedToIds.length > 0) {
      const admin = createAdminClient();
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', assignedToIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Recalculate current amounts from transactions for each goal
    if (data && data.length > 0) {
      for (const goal of data) {
        if (goal.category_id) {
          // Sum all transactions with this category
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', ownerId)
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

    // Merge assigned_to_profile data
    const transformedData = (data || []).map((goal: any) => {
      const assignedProfile = goal.assigned_to 
        ? (profilesMap[goal.assigned_to] || null)
        : null;

      return {
        ...goal,
        assigned_to_profile: assignedProfile,
      };
    });

    return NextResponse.json({ data: transformedData });
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
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const validated = goalSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this goal (using goal name directly)
    const categoryName = validated.name.toUpperCase();
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        user_id: ownerId,
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

    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const includeInPlan = hasCustomPlan ? true : validated.include_in_plan;

    // Calculate monthly contribution if include_in_plan is true and target_date is provided
    let monthlyContributionCents = hasCustomPlan ? undefined : validated.monthly_contribution_cents;
    if (includeInPlan && !monthlyContributionCents && validated.target_date) {
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
      user_id: ownerId,
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
      assigned_to: validated.assigned_to || null,
    };

    // Add contribution fields that may not exist
    if (monthlyContributionCents !== undefined) {
      contributionFields.monthly_contribution_cents = monthlyContributionCents;
    }
    if (includeInPlan !== undefined) {
      contributionFields.include_in_plan = includeInPlan;
    }
    if (!hasCustomPlan && validated.contribution_frequency !== undefined) {
      contributionFields.contribution_frequency = validated.contribution_frequency;
    }
    if (!hasCustomPlan && validated.contribution_count !== undefined) {
      contributionFields.contribution_count = validated.contribution_count;
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

    // Insert custom plan entries if provided
    if (data && validated.plan_entries && validated.plan_entries.length > 0) {
      const planEntries = validated.plan_entries.map((entry) => ({
        user_id: ownerId,
        goal_id: data.id,
        category_id: data.category_id || null,
        entry_month: `${entry.month}-01`,
        amount_cents: entry.amount_cents,
        description: `Plano personalizado - ${data.name}`,
      }));

      const { error: planError } = await supabase
        .from('goal_plan_entries')
        .upsert(planEntries, {
          onConflict: 'goal_id,entry_month',
        });

      if (planError) {
        console.error('Error inserting goal plan entries:', planError);
      }
    }

    // Generate automatic budgets if include_in_plan is true
    if (data.include_in_plan && data.status === 'active' && data.category_id) {
      try {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 12); // Next 12 months
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        await generateAutoBudgetsForGoal(
          supabase,
          ownerId,
          {
            id: data.id,
            category_id: data.category_id,
          include_in_plan: data.include_in_plan,
            status: data.status,
            contribution_frequency: data.contribution_frequency,
            contribution_count: data.contribution_count,
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

        projectionCache.invalidateUser(ownerId);
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



