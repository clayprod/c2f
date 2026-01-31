import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { budgetSchema, budgetQuerySchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateProjections } from '@/services/projections/generator';
import { projectionCache } from '@/services/projections/cache';
import { calculateMinimumBudget } from '@/services/budgets/minimumCalculator';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { generateOverdraftInterestBudget } from '@/services/budgets/overdraftInterest';
import { generateAccountYieldBudget } from '@/services/budgets/accountYield';

const MAX_PROJECTION_YEARS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

type BudgetBreakdownItemInput = { id?: string; label: string; amount_cents: number };

function buildBudgetBreakdownMetadata(items: BudgetBreakdownItemInput[]) {
  return {
    budget_breakdown: {
      enabled: true,
      items: items.map((it) => ({
        id: it.id,
        label: it.label,
        amount_cents: Math.round(it.amount_cents),
      })),
    },
  };
}

function sumBreakdownItemsCents(items: BudgetBreakdownItemInput[]) {
  return items.reduce((sum, it) => sum + Math.round(it.amount_cents || 0), 0);
}

// Simple rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const includeProjections = searchParams.get('include_projections') === 'true';

    const { supabase } = createClientFromRequest(request);

    // If not including projections, return existing behavior
    if (!includeProjections) {
      let query = supabase
        .from('budgets')
        .select('*, categories(*)')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false });

      if (month) {
        const [yearStr, monthStr] = month.split('-');
        const yearNum = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);
        query = query.eq('year', yearNum).eq('month', monthNum);

        // Generate overdraft interest and yield budgets for this month
        // (calculates from previous month, creates budget for target month)
        // Only generate if previous month has closed (we're in a month after the target)
        const today = new Date();
        const targetDate = new Date(yearNum, monthNum - 1, 1);
        const previousMonth = new Date(targetDate);
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        
        // Only generate if we're past the target month (previous month has closed)
        if (today > targetDate) {
          try {
            await generateOverdraftInterestBudget(supabase, ownerId, yearNum, monthNum);
          } catch (error) {
            console.error('Error generating overdraft interest budget:', error);
            // Continue even if generation fails
          }

          try {
            await generateAccountYieldBudget(supabase, ownerId, yearNum, monthNum);
          } catch (error) {
            console.error('Error generating account yield budget:', error);
            // Continue even if generation fails
          }

          // Re-fetch budgets after generation to include new ones
          const { data: refreshedBudgets, error: refreshError } = await query;
          if (!refreshError && refreshedBudgets) {
            query = supabase
              .from('budgets')
              .select('*, categories(*)')
              .eq('user_id', ownerId)
              .eq('year', yearNum)
              .eq('month', monthNum)
              .order('created_at', { ascending: false });
          }
        }
      }

      const { data: budgets, error } = await query;

      if (error) throw error;

      // Calculate actual amounts from transactions for each budget
      const budgetsWithActuals = await Promise.all(
        (budgets || []).map(async (budget: any) => {
          // Calculate start and end dates for the budget month
          const startDate = new Date(budget.year, budget.month - 1, 1);
          const endDate = new Date(budget.year, budget.month, 0); // Last day of the month

          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];

          // Fetch transactions for this category and month
          const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', ownerId)
            .eq('category_id', budget.category_id)
            .gte('posted_at', startDateStr)
            .lte('posted_at', endDateStr);

          if (txError) {
            console.error('Error fetching transactions for budget:', txError);
            // Continue with stored amount_actual if query fails
            return {
              ...budget,
              limit_cents: budget.amount_planned_cents || 0,
              amount_actual_cents: Math.round((budget.amount_actual || 0) * 100),
            };
          }

          // Sum up transaction amounts (negative for expenses, positive for income)
          const actualAmount = transactions?.reduce((sum, tx) => {
            // amount is NUMERIC in database (reais), can be negative (expense) or positive (income)
            return sum + Number(tx.amount || 0);
          }, 0) || 0;

          // Update budget in database if amount changed (async, don't wait)
          if (Math.abs(actualAmount - (budget.amount_actual || 0)) > 0.01) {
            supabase
              .from('budgets')
              .update({ amount_actual: actualAmount })
              .eq('id', budget.id)
              .then(({ error: updateError }) => {
                if (updateError) {
                  console.error('Error updating budget actual amount:', updateError);
                }
              });
          }

          return {
            ...budget,
            limit_cents: budget.amount_planned_cents || 0,
            amount_actual_cents: Math.round(actualAmount * 100), // Convert to cents
            amount_actual: actualAmount, // Also include in reais for consistency
          };
        })
      );

      return NextResponse.json({ data: budgetsWithActuals });
    }

    // Include projections - validate and parse query parameters
    const queryParams = {
      include_projections: searchParams.get('include_projections') || 'true',
      start_month: searchParams.get('start_month') || undefined,
      end_month: searchParams.get('end_month') || undefined,
      projection_years: searchParams.get('projection_years') || undefined,
    };

    const validated = budgetQuerySchema.parse(queryParams);

    // Rate limiting
    if (!checkRateLimit(ownerId)) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
        { status: 429 }
      );
    }

    // Calculate date range
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    let startDate: Date;
    let endDate: Date;

    if (validated.start_month && validated.end_month) {
      const [startYear, startMonth] = validated.start_month.split('-').map(Number);
      const [endYear, endMonth] = validated.end_month.split('-').map(Number);
      startDate = new Date(startYear, startMonth - 1, 1);
      endDate = new Date(endYear, endMonth, 0); // Last day of end month
    } else {
      // Default: 5 months back, 6 months forward
      const projectionYears = validated.projection_years || 0.5;
      const monthsForward = Math.min(Math.round(projectionYears * 12), MAX_PROJECTION_YEARS * 12);

      startDate = new Date(currentYear, currentMonth - 5, 1);
      endDate = new Date(currentYear, currentMonth + monthsForward + 1, 0);
    }

    // Validate period
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());
    if (monthsDiff > MAX_PROJECTION_YEARS * 12) {
      return NextResponse.json(
        { error: `Período máximo de projeção é ${MAX_PROJECTION_YEARS} anos` },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Data inicial deve ser anterior à data final' },
        { status: 400 }
      );
    }

    // Check cache
    const startMonthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endMonthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
    const cached = projectionCache.get(ownerId, startMonthKey, endMonthKey);

    if (cached) {
      return NextResponse.json({ data: cached });
    }

    // Get manual budgets for the period
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;

    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('*, categories(*)')
      .eq('user_id', ownerId)
      .gte('year', startYear)
      .lte('year', endYear)
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (budgetsError) throw budgetsError;

    // Filter budgets by month range
    const filteredBudgets = (budgets || []).filter((budget: any) => {
      if (budget.year < startYear || budget.year > endYear) return false;
      if (budget.year === startYear && budget.month < startMonth) return false;
      if (budget.year === endYear && budget.month > endMonth) return false;
      return true;
    });

    // Get actual transactions for the period to calculate real income/expenses
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('amount, posted_at, category_id, categories(type)')
      .eq('user_id', ownerId)
      .gte('posted_at', startDate.toISOString().split('T')[0])
      .lte('posted_at', endDate.toISOString().split('T')[0]);

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }

    // Group transactions by month
    const actualMonthlyTotals: Record<string, { income: number; expenses: number }> = {};
    if (transactions) {
      for (const tx of transactions) {
        // Parse date parts directly to avoid timezone issues
        const [yearStr, monthStr] = tx.posted_at.split('-');
        const monthKey = `${yearStr}-${monthStr}`;

        if (!actualMonthlyTotals[monthKey]) {
          actualMonthlyTotals[monthKey] = { income: 0, expenses: 0 };
        }

        const amountReais = parseFloat(tx.amount?.toString() || '0');
        const amountCents = Math.round(amountReais * 100); // Convert to cents
        const category = tx.categories as any;
        // Use category type as primary source of truth, fallback to amount sign
        const isIncome = category?.type === 'income' || (category?.type !== 'expense' && amountReais > 0);

        if (isIncome) {
          actualMonthlyTotals[monthKey].income += Math.abs(amountCents);
        } else {
          actualMonthlyTotals[monthKey].expenses += Math.abs(amountCents);
        }
      }
    }

    // Generate projections
    let projections: any[] = [];
    let monthlyTotals: Record<string, { income: number; expenses: number }> = {};
    let projectionErrors: string[] | undefined;

    try {
      const projectionResult = await generateProjections(
        supabase,
        ownerId,
        startDate,
        endDate
      );
      projections = projectionResult.projections;
      monthlyTotals = projectionResult.monthlyTotals;
      projectionErrors = projectionResult.errors;
    } catch (error: any) {
      console.error('Error generating projections:', error);
      projectionErrors = [error.message || 'Erro ao gerar projeções'];
    }

    // Calculate actual amounts from transactions for each budget
    const transformedBudgets = await Promise.all(
      filteredBudgets.map(async (budget: any) => {
        // Calculate start and end dates for the budget month
        const budgetStartDate = new Date(budget.year, budget.month - 1, 1);
        const budgetEndDate = new Date(budget.year, budget.month, 0); // Last day of the month

        const budgetStartStr = budgetStartDate.toISOString().split('T')[0];
        const budgetEndStr = budgetEndDate.toISOString().split('T')[0];

        // Fetch transactions for this category and month
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', ownerId)
          .eq('category_id', budget.category_id)
          .gte('posted_at', budgetStartStr)
          .lte('posted_at', budgetEndStr);

        let actualAmount = budget.amount_actual || 0;

        if (!txError && transactions) {
          // Sum up transaction amounts (negative for expenses, positive for income)
          actualAmount = transactions.reduce((sum, tx) => {
            return sum + Number(tx.amount || 0);
          }, 0);

          // Update budget in database if amount changed (async, don't wait)
          if (Math.abs(actualAmount - (budget.amount_actual || 0)) > 0.01) {
            supabase
              .from('budgets')
              .update({ amount_actual: actualAmount })
              .eq('id', budget.id)
              .then(({ error: updateError }) => {
                if (updateError) {
                  console.error('Error updating budget actual amount:', updateError);
                }
              });
          }
        }

        return {
          ...budget,
          limit_cents: budget.amount_planned_cents || 0,
          amount_actual_cents: Math.round(actualAmount * 100),
          amount_actual: actualAmount, // Include in reais for consistency
          source_type: budget.source_type || 'manual',
          is_projected: budget.is_projected || false,
        };
      })
    );

    // Convert projections to budget-like format for consistency
    const projectionBudgets = projections.map((proj) => {
      const date = new Date(proj.date + 'T12:00:00');
      const plannedCents = Math.abs(proj.amount_cents);
      // Determine if this is income based on amount sign
      // proj.amount_cents > 0 means income, < 0 means expense
      const isIncome = proj.amount_cents > 0;
      return {
        id: proj.id,
        category_id: proj.category_id || null,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        amount_planned_cents: plannedCents,
        amount_actual: 0,
        limit_cents: plannedCents,
        amount_actual_cents: 0,
        source_type: proj.source_type,
        source_id: proj.source_id,
        is_projected: true,
        // Include type in categories so the totals calculation can distinguish income/expense
        categories: proj.category_name 
          ? { name: proj.category_name, type: isIncome ? 'income' : 'expense' } 
          : { type: isIncome ? 'income' : 'expense' },
        metadata: proj.metadata,
        description: proj.description,
      };
    });

    const toBudgetKey = (entry: {
      year: number;
      month: number;
      category_id?: string | null;
      source_type?: string | null;
      source_id?: string | null;
    }) => {
      const categoryId = entry.category_id || 'none';
      const sourceType = entry.source_type || 'manual';
      const sourceId = entry.source_id || 'none';
      return `${entry.year}-${entry.month}-${categoryId}-${sourceType}-${sourceId}`;
    };

    const existingBudgetKeys = new Set(
      transformedBudgets.map((budget: any) =>
        toBudgetKey({
          year: budget.year,
          month: budget.month,
          category_id: budget.category_id,
          source_type: budget.source_type,
          source_id: budget.source_id,
        })
      )
    );

    // Filter out projections with zero/invalid amounts or already persisted budgets
    const validProjectionBudgets = projectionBudgets.filter((proj) => {
      if (proj.amount_planned_cents <= 0) return false;
      const key = toBudgetKey({
        year: proj.year,
        month: proj.month,
        category_id: proj.category_id,
        source_type: proj.source_type,
        source_id: proj.source_id,
      });
      return !existingBudgetKeys.has(key);
    });

    // Combine budgets and projections
    const allBudgets = [...transformedBudgets, ...validProjectionBudgets];

    // Calculate monthly totals including actuals
    const allMonthlyTotals: Record<string, {
      planned_income: number;
      planned_expenses: number;
      actual_income: number;
      actual_expenses: number;
    }> = {};

    // Initialize all months in range
    const current = new Date(startDate);
    while (current <= endDate) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      allMonthlyTotals[monthKey] = {
        planned_income: 0,
        planned_expenses: 0,
        actual_income: 0,
        actual_expenses: 0,
      };
      current.setMonth(current.getMonth() + 1);
    }

    // Sum up budgets and projections
    for (const budget of allBudgets) {
      const monthKey = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
      if (!allMonthlyTotals[monthKey]) continue;

      const amountCents = budget.amount_planned_cents || 0;
      const category = budget.categories;
      const isIncome = category?.type === 'income';

      // Use category type to determine income vs expense, not the sign of the amount
      if (isIncome) {
        allMonthlyTotals[monthKey].planned_income += Math.abs(amountCents);
      } else {
        allMonthlyTotals[monthKey].planned_expenses += Math.abs(amountCents);
      }
      // NOTE: Actual amounts are added from actualMonthlyTotals below (lines ~528-534)
      // to avoid double counting - budget.amount_actual would duplicate transaction totals
    }

    // Before adding income projections, check if there are income budgets
    // Check both in manual budgets and projections
    const hasIncomeBudgets = allBudgets.some(b => {
      const category = b.categories;
      return category && category.type === 'income';
    });

    // Also check if there are recurring income transactions in projections
    const hasRecurringIncome = Object.values(monthlyTotals).some(totals => totals.income > 0);

    // Add projection totals to planned - REMOVED TO FIX DOUBLE COUNTING
    // The monthlyTotals are already included via projectionBudgets which are merged into allBudgets
    // and then processed into allMonthlyTotals in the loop above (lines ~267)

    /* 
    for (const [monthKey, totals] of Object.entries(monthlyTotals)) {
      if (allMonthlyTotals[monthKey]) {
        // Only add income if there are income budgets OR recurring income transactions
        if (hasIncomeBudgets || hasRecurringIncome) {
          allMonthlyTotals[monthKey].planned_income += totals.income;
        }
        allMonthlyTotals[monthKey].planned_expenses += totals.expenses;
      }
    }
    */

    // Add actual transactions to actual totals
    for (const [monthKey, totals] of Object.entries(actualMonthlyTotals)) {
      if (allMonthlyTotals[monthKey]) {
        allMonthlyTotals[monthKey].actual_income += totals.income;
        allMonthlyTotals[monthKey].actual_expenses += totals.expenses;
      }
    }

    const result = {
      budgets: allBudgets,
      monthly_totals: allMonthlyTotals,
      errors: projectionErrors,
    };

    // Cache result
    projectionCache.set(ownerId, startMonthKey, endMonthKey, result);

    return NextResponse.json({ data: result });
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

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();

    // Validate and transform
    let validated;
    try {
      validated = budgetSchema.parse(body);
    } catch (validationError: any) {
      console.error('Budget validation error:', validationError);
      if (validationError.errors) {
        const firstError = validationError.errors[0];
        return NextResponse.json(
          { error: firstError?.message || 'Erro de validação', details: validationError.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Erro de validação dos dados' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);
    // Parse month to year and month integers
    // Use T12:00:00 to avoid timezone issues (UTC midnight can become previous day in local timezone)
    const monthDate = new Date(validated.month + 'T12:00:00');
    if (isNaN(monthDate.getTime())) {
      return NextResponse.json(
        { error: 'Data inválida' },
        { status: 400 }
      );
    }

    const hasBreakdown = Array.isArray(validated.breakdown_items) && validated.breakdown_items.length > 0;
    const breakdownItems = (validated.breakdown_items || []) as BudgetBreakdownItemInput[];

    // Determine planned amount in cents (either direct limit or sum of breakdown)
    const limitCents = hasBreakdown
      ? sumBreakdownItemsCents(breakdownItems)
      : Math.round(validated.limit_cents || 0);

    if (limitCents <= 0) {
      return NextResponse.json(
        { error: 'Limite deve ser maior que zero' },
        { status: 400 }
      );
    }

    // Check if category is an automatic category - block manual creation
    const { data: category } = await supabase
      .from('categories')
      .select('source_type')
      .eq('id', validated.category_id)
      .single();

    const automaticSourceTypes = ['credit_card', 'goal', 'debt', 'investment'];
    if (category?.source_type && automaticSourceTypes.includes(category.source_type)) {
      const typeLabels: Record<string, string> = {
        credit_card: 'cartão de crédito',
        goal: 'objetivo',
        debt: 'dívida',
        investment: 'investimento',
      };
      const typeLabel = typeLabels[category.source_type] || category.source_type;

      return NextResponse.json(
        {
          error: `Orçamentos de ${typeLabel} são gerados automaticamente. Não é possível criar manualmente.`,
          source_type: category.source_type,
        },
        { status: 400 }
      );
    }

    // Calculate minimum amount based on automatic contributions
    const { minimum_cents, sources } = await calculateMinimumBudget(
      supabase,
      ownerId,
      validated.category_id,
      monthDate.getFullYear(),
      monthDate.getMonth() + 1
    );

    const minimumAmount = minimum_cents / 100; // For display

    // Validate that planned amount is not below minimum
    if (limitCents < minimum_cents) {
      const sourcesText = sources.map(s => s.description).join(', ');
      return NextResponse.json(
        {
          error: `O orçamento deve ser no mínimo ${minimumAmount.toFixed(2)} devido a contribuições automáticas.`,
          minimum_amount: minimumAmount,
          minimum_cents: minimum_cents,
          sources: sources,
          sources_text: sourcesText,
          suggestion: sourcesText
            ? `Há contribuições automáticas: ${sourcesText}. O orçamento deve cobrir pelo menos esse valor.`
            : 'Verifique as transações recorrentes, objetivos, dívidas e investimentos marcados para incluir no orçamento.'
        },
        { status: 400 }
      );
    }

    // Prepare insert data - start with required fields only
    const insertData: any = {
      category_id: validated.category_id,
      year: monthDate.getFullYear(),
      month: monthDate.getMonth() + 1,
      amount_planned_cents: limitCents,
      user_id: ownerId,
    };

    // Try to add new fields (will be ignored if columns don't exist)
    insertData.minimum_amount_planned_cents = minimum_cents;
    insertData.auto_contributions_cents = minimum_cents;

    // Add breakdown metadata if present
    if (hasBreakdown) {
      insertData.metadata = buildBudgetBreakdownMetadata(breakdownItems);
    }

    // Add new fields (will be ignored if columns don't exist)
    insertData.source_type = validated.source_type || 'manual';
    insertData.is_projected = validated.is_projected ?? false;

    if (validated.source_id) {
      insertData.source_id = validated.source_id;
    }

    console.log('Attempting to insert budget with data:', {
      ...insertData,
      amount_planned_cents: limitCents,
    });

    let data: any = null;
    let error: any = null;

    // Try insert with metadata; fallback if column doesn't exist
    const initialInsert = await supabase
      .from('budgets')
      .insert(insertData)
      .select('*, categories(*)')
      .single();

    data = initialInsert.data;
    error = initialInsert.error;

    if (error) {
      const errorMsg = error.message?.toLowerCase?.() || '';
      if (errorMsg.includes('metadata') && errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        const { metadata, ...fallback } = insertData;
        const fallbackInsert = await supabase
          .from('budgets')
          .insert(fallback)
          .select('*, categories(*)')
          .single();
        data = fallbackInsert.data;
        error = fallbackInsert.error;
      }
    }

    if (error) {
      console.error('Database error creating budget:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um orçamento para esta categoria neste mês' },
          { status: 400 }
        );
      }
      // Check for check constraint violation
      if (error.code === '23514') {
        return NextResponse.json(
          { error: 'Dados inválidos: verifique os valores informados' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'Erro ao criar orçamento', code: error.code },
        { status: 500 }
      );
    }

    // Convert planned amount to limit_cents for API response
    const transformedData = {
      ...data,
      limit_cents: data.amount_planned_cents || 0,
      amount_actual_cents: Math.round((data.amount_actual || 0) * 100),
    };

    return NextResponse.json({ data: transformedData }, { status: 201 });
  } catch (error: any) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      // Format Zod validation errors
      const zodError = error as any;
      const firstError = zodError.errors?.[0];
      const errorMessage = firstError?.message || 'Erro de validação';
      return NextResponse.json(
        { error: errorMessage, details: zodError.errors },
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

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month) {
      return NextResponse.json(
        { error: 'Parâmetro month é obrigatório' },
        { status: 400 }
      );
    }

    const [yearStr, monthStr] = month.split('-');
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Formato de mês inválido. Use YYYY-MM' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // First, get all manual budgets for this month to verify they exist
    // Only delete manual budgets (not auto-generated ones)
    let query = supabase
      .from('budgets')
      .select('id, is_auto_generated, source_type')
      .eq('user_id', ownerId)
      .eq('year', yearNum)
      .eq('month', monthNum);

    // Try with is_auto_generated column first
    const budgetsResult = await query;

    // If column doesn't exist, fallback to checking source_type
    if (budgetsResult.error?.code === '42703' && budgetsResult.error?.message?.includes('is_auto_generated')) {
      const fallbackQuery = supabase
        .from('budgets')
        .select('id, source_type')
        .eq('user_id', ownerId)
        .eq('year', yearNum)
        .eq('month', monthNum);
      
      const fallbackResult = await fallbackQuery;
      
      if (fallbackResult.error) {
        return NextResponse.json(
          { error: 'Erro ao buscar orçamentos', details: fallbackResult.error.message },
          { status: 500 }
        );
      }

      // Filter out auto-generated budgets based on source_type
      const manualBudgets = (fallbackResult.data || []).filter(
        (b: any) => !b.source_type || b.source_type === 'manual'
      );

      if (manualBudgets.length === 0) {
        return NextResponse.json(
          { message: 'Nenhum orçamento manual encontrado para excluir', deleted_count: 0 },
          { status: 200 }
        );
      }

      // Delete manual budgets
      const budgetIds = manualBudgets.map((b: any) => b.id);
      const { error: deleteError } = await supabase
        .from('budgets')
        .delete()
        .eq('user_id', ownerId)
        .in('id', budgetIds);

      if (deleteError) {
        return NextResponse.json(
          { error: 'Erro ao excluir orçamentos', details: deleteError.message },
          { status: 500 }
        );
      }

      // Clear cache
      try {
        projectionCache.invalidateUser(ownerId);
      } catch (cacheError) {
        console.error('Cache invalidation error:', cacheError);
      }

      return NextResponse.json(
        { message: `${manualBudgets.length} orçamento(s) excluído(s) com sucesso`, deleted_count: manualBudgets.length },
        { status: 200 }
      );
    }

    if (budgetsResult.error) {
      return NextResponse.json(
        { error: 'Erro ao buscar orçamentos', details: budgetsResult.error.message },
        { status: 500 }
      );
    }

    // Filter out auto-generated budgets
    const manualBudgets = (budgetsResult.data || []).filter(
      (b: any) => !b.is_auto_generated && (!b.source_type || b.source_type === 'manual')
    );

    if (manualBudgets.length === 0) {
      return NextResponse.json(
        { message: 'Nenhum orçamento manual encontrado para excluir', deleted_count: 0 },
        { status: 200 }
      );
    }

    // Delete manual budgets
    const budgetIds = manualBudgets.map((b: any) => b.id);
    const { error: deleteError } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', ownerId)
      .in('id', budgetIds);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erro ao excluir orçamentos', details: deleteError.message },
        { status: 500 }
      );
    }

    // Clear cache
    try {
      projectionCache.invalidateUser(ownerId);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
    }

    return NextResponse.json(
      { message: `${manualBudgets.length} orçamento(s) excluído(s) com sucesso`, deleted_count: manualBudgets.length },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete all budgets error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error || 'Erro ao excluir orçamentos' },
      { status: errorResponse.statusCode || 500 }
    );
  }
}
