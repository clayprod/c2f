import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserId } from '@/lib/auth';
import { investmentSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateAutoBudgetsForInvestment } from '@/services/budgets/autoGenerator';
import { projectionCache } from '@/services/projections/cache';
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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const { supabase } = createClientFromRequest(request);
    const buildQuery = (selectColumns: string) => {
      let query = supabase
        .from('investments')
        .select(selectColumns)
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }
      if (type) {
        query = query.eq('type', type);
      }

      return query;
    };

    let { data, error }: { data: any[] | null; error: any } = await buildQuery('*, accounts(*), categories(*)');

    if (error && shouldDropCategorySelect(error)) {
      ({ data, error } = await buildQuery('*, accounts(*)') as { data: any[] | null; error: any });
    }

    if (error) throw error;

    // Fetch assigned_to profiles separately using admin client (bypasses RLS)
    const assignedToIds = [...new Set((data || [])
      .map((investment: any) => investment.assigned_to)
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

    // Recalculate current values from transactions for each investment
    if (data && data.length > 0) {
      for (const investment of data) {
        if (investment.category_id) {
          // Sum all transactions with this category
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', ownerId)
            .eq('category_id', investment.category_id);

          if (transactions && transactions.length > 0) {
            // Expenses (negative) = contributions (increase value)
            // Income (positive) = withdrawals (decrease value)
            const contributions = transactions
              .filter((tx: any) => tx.amount < 0)
              .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount * 100), 0);
            
            const withdrawals = transactions
              .filter((tx: any) => tx.amount > 0)
              .reduce((sum: number, tx: any) => sum + (tx.amount * 100), 0);

            const calculatedValue = (investment.initial_investment_cents || 0) + contributions - withdrawals;
            
            // Update investment if current value differs
            if (calculatedValue !== (investment.current_value_cents || investment.initial_investment_cents || 0)) {
              await supabase
                .from('investments')
                .update({ current_value_cents: calculatedValue })
                .eq('id', investment.id);
              
              investment.current_value_cents = calculatedValue;
            }
          }
        }
      }
    }

    // Merge assigned_to_profile data
    const transformedData = (data || []).map((investment: any) => {
      const assignedProfile = investment.assigned_to 
        ? (profilesMap[investment.assigned_to] || null)
        : null;

      return {
        ...investment,
        assigned_to_profile: assignedProfile,
      };
    });

    const normalizedData = transformedData.map((investment) =>
      normalizeIncludeInPlan(investment)
    );

    return NextResponse.json({ data: normalizedData });
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
    const validated = investmentSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Create a category for this investment (using investment name directly)
    const categoryName = validated.name.toUpperCase();
    let { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        user_id: ownerId,
        name: categoryName,
        type: 'expense', // Contributions are expenses, but can also be used for income (dividends/withdrawals)
        icon: '📊',
        color: '#00CED1',
        source_type: 'investment',
      })
      .select()
      .single();

    if (categoryError && categoryError.code === '42703') {
      const missingColumn = getMissingColumn(categoryError);
      if (missingColumn === 'source_type') {
        const retryResult = await supabase
          .from('categories')
          .insert({
            user_id: ownerId,
            name: categoryName,
            type: 'expense',
            icon: '📊',
            color: '#00CED1',
          })
          .select()
          .single();

        category = retryResult.data;
        categoryError = retryResult.error;
      }
    }

    if (categoryError) {
      console.error('Error creating investment category:', categoryError);
    }

    const hasCustomPlan = !!validated.plan_entries && validated.plan_entries.length > 0;
    const includeInPlan = hasCustomPlan ? true : validated.include_in_plan;
    const { plan_entries, ...investmentData } = validated;

    let insertPayload: Record<string, any> = {
      ...investmentData,
      user_id: ownerId,
      include_in_plan: includeInPlan,
      contribution_frequency: hasCustomPlan ? null : validated.contribution_frequency || null,
      contribution_count: hasCustomPlan ? null : validated.contribution_count || null,
      initial_investment_cents: validated.initial_investment_cents,
      current_value_cents: validated.current_value_cents || validated.initial_investment_cents,
      category_id: category?.id,
      assigned_to: validated.assigned_to || null,
    };

    let selectColumns = '*, accounts(*), categories(*)';
    let { data, error } = await supabase
      .from('investments')
      .insert(insertPayload)
      .select(selectColumns)
      .single();

    if (error) {
      let fallbackError: any = error;
      let fallbackPayload = insertPayload;
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
          .insert(fallbackPayload)
          .select(selectColumns)
          .single();

        data = retryResult.data;
        error = retryResult.error;
        fallbackError = retryResult.error;

        if (!retryResult.error) {
          insertPayload = fallbackPayload;
          break;
        }
      }
    }

    if (error) throw error;

    const normalizedData = normalizeIncludeInPlan(data, includeInPlan);

    if (normalizedData && validated.plan_entries && validated.plan_entries.length > 0) {
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
        console.error('Error inserting investment plan entries:', planError);
      }
    }

    // Generate automatic budgets if include_in_plan is true
    if (normalizedData.include_in_plan && normalizedData.status === 'active' && normalizedData.category_id) {
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
            overwrite: false,
          }
        );

        projectionCache.invalidateUser(ownerId);
      } catch (budgetError) {
        console.error('Error generating auto budgets for investment:', budgetError);
        // Don't fail the investment creation if budget generation fails
      }
    }

    // Create purchase transaction if requested
    const createPurchaseTransaction = (body as any).create_purchase_transaction === true;
    if (createPurchaseTransaction && normalizedData.category_id) {
      try {
        // Get default account if account_id not provided
        let accountId = validated.account_id;
        if (!accountId) {
          const { data: defaultAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', ownerId)
            .eq('type', 'checking')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          accountId = defaultAccount?.id;
        }

        if (accountId) {
          const { error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: ownerId,
              account_id: accountId,
              category_id: normalizedData.category_id,
              posted_at: validated.purchase_date,
              description: `Compra: ${validated.name}`,
              amount: -validated.initial_investment_cents / 100, // Negative for expense
              currency: 'BRL',
              source: 'manual',
            });

          if (txError) {
            console.error('Error creating purchase transaction:', txError);
            // Don't fail the whole operation if transaction creation fails
          }
        }
      } catch (txError: any) {
        console.error('Error creating purchase transaction:', txError);
        // Don't fail the whole operation if transaction creation fails
      }
    }

    return NextResponse.json({
      data: {
        ...normalizedData,
        category_id: normalizedData.category_id ?? category?.id,
        category_name: category?.name,
      }
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
