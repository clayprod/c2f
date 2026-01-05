import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { reportFiltersSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { ZodError } from 'zod';

interface TransactionRow {
  amount: number; // NUMERIC from DB
  posted_at: string;
  categories?: { type: string; name: string } | null;
}

interface BudgetRow {
  amount_planned: number; // NUMERIC from DB
  month: string;
  categories?: { name: string; type: string } | null;
}

interface GoalRow {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  target_date: string | null;
  status: string;
}

interface DebtRow {
  id: string;
  name: string;
  total_amount_cents: number;
  paid_amount_cents: number;
  due_date: string | null;
  status: string;
  interest_rate: number;
}

interface InvestmentRow {
  id: string;
  name: string;
  type: string;
  initial_investment_cents: number;
  current_value_cents: number | null;
  status: string;
}

interface CategorySummary {
  category: string;
  categoryId: string | null;
  total_cents: number;
  count: number;
  percentage: number;
}

interface PeriodData {
  period: string;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
}

interface BudgetComparison {
  category: string;
  categoryId: string;
  budgeted_cents: number;
  spent_cents: number;
  remaining_cents: number;
  percentage: number;
  status: 'under' | 'near' | 'over';
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const filters = reportFiltersSchema.parse({
      startDate: searchParams.get('startDate') || getDefaultStartDate(),
      endDate: searchParams.get('endDate') || getDefaultEndDate(),
      accountIds: searchParams.get('accountIds')?.split(',').filter(Boolean) || undefined,
      categoryIds: searchParams.get('categoryIds')?.split(',').filter(Boolean) || undefined,
      reportType: searchParams.get('reportType') || 'overview',
      groupBy: searchParams.get('groupBy') || 'month',
    });

    const supabase = await createClient();

    switch (filters.reportType) {
      case 'overview':
        return NextResponse.json(await getOverviewReport(supabase, userId, filters));
      case 'categories':
        return NextResponse.json(await getCategoriesReport(supabase, userId, filters));
      case 'budgets':
        return NextResponse.json(await getBudgetsReport(supabase, userId, filters));
      case 'goals':
        return NextResponse.json(await getGoalsReport(supabase, userId, filters));
      case 'debts':
        return NextResponse.json(await getDebtsReport(supabase, userId, filters));
      case 'investments':
        return NextResponse.json(await getInvestmentsReport(supabase, userId, filters));
      case 'cashflow':
        return NextResponse.json(await getCashflowReport(supabase, userId, filters));
      default:
        return NextResponse.json(await getOverviewReport(supabase, userId, filters));
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: error.errors },
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

function getDefaultStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 11);
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0];
}

type ReportFilters = {
  startDate: string;
  endDate: string;
  accountIds?: string[];
  categoryIds?: string[];
  groupBy: 'day' | 'week' | 'month' | 'year';
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function getOverviewReport(
  supabase: SupabaseClient,
  userId: string,
  filters: ReportFilters
) {
  let query = supabase
    .from('transactions')
    .select('amount, posted_at, categories(type, name)')
    .eq('user_id', userId)
    .gte('posted_at', filters.startDate)
    .lte('posted_at', filters.endDate);

  if (filters.accountIds?.length) {
    query = query.in('account_id', filters.accountIds);
  }
  if (filters.categoryIds?.length) {
    query = query.in('category_id', filters.categoryIds);
  }

  const { data: transactions, error } = await query;
  if (error) throw error;

  const typedTransactions = transactions as unknown as TransactionRow[];

  let totalIncome = 0;
  let totalExpense = 0;
  const periodMap = new Map<string, PeriodData>();

  for (const tx of typedTransactions) {
    const periodKey = getPeriodKey(tx.posted_at, filters.groupBy);
    // Convert NUMERIC to cents
    const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
    const isIncome = tx.categories?.type === 'income' || tx.amount > 0;
    const amount = amountCents;

    if (isIncome) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        period: periodKey,
        income_cents: 0,
        expense_cents: 0,
        balance_cents: 0,
      });
    }

    const period = periodMap.get(periodKey)!;
    if (isIncome) {
      period.income_cents += amount;
    } else {
      period.expense_cents += amount;
    }
    period.balance_cents = period.income_cents - period.expense_cents;
  }

  const periods = Array.from(periodMap.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );

  return {
    data: {
      summary: {
        total_income_cents: totalIncome,
        total_expense_cents: totalExpense,
        balance_cents: totalIncome - totalExpense,
        savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
        transaction_count: typedTransactions.length,
      },
      periods,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy,
      },
    },
  };
}

async function getCategoriesReport(
  supabase: SupabaseClient,
  userId: string,
  filters: ReportFilters
) {
  let query = supabase
    .from('transactions')
    .select('amount, category_id, categories(name, type)')
    .eq('user_id', userId)
    .gte('posted_at', filters.startDate)
    .lte('posted_at', filters.endDate);

  if (filters.accountIds?.length) {
    query = query.in('account_id', filters.accountIds);
  }

  const { data: transactions, error } = await query;
  if (error) throw error;

  interface TxWithCategory {
    amount: number; // NUMERIC from DB
    category_id: string | null;
    categories?: { name: string; type: string } | null;
  }

  const typedTransactions = transactions as unknown as TxWithCategory[];

  const incomeByCategory = new Map<string, { name: string; id: string | null; total: number; count: number }>();
  const expenseByCategory = new Map<string, { name: string; id: string | null; total: number; count: number }>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of typedTransactions) {
    const categoryName = tx.categories?.name || 'Sem Categoria';
    const categoryId = tx.category_id;
    // Convert NUMERIC to cents
    const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
    const isIncome = tx.categories?.type === 'income' || tx.amount > 0;
    const amount = amountCents;

    const map = isIncome ? incomeByCategory : expenseByCategory;
    if (isIncome) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    if (!map.has(categoryName)) {
      map.set(categoryName, { name: categoryName, id: categoryId, total: 0, count: 0 });
    }
    const cat = map.get(categoryName)!;
    cat.total += amount;
    cat.count += 1;
  }

  const formatCategories = (
    map: Map<string, { name: string; id: string | null; total: number; count: number }>,
    total: number
  ): CategorySummary[] => {
    return Array.from(map.values())
      .map((cat) => ({
        category: cat.name,
        categoryId: cat.id,
        total_cents: cat.total,
        count: cat.count,
        percentage: total > 0 ? (cat.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total_cents - a.total_cents);
  };

  return {
    data: {
      income: {
        total_cents: totalIncome,
        categories: formatCategories(incomeByCategory, totalIncome),
      },
      expense: {
        total_cents: totalExpense,
        categories: formatCategories(expenseByCategory, totalExpense),
      },
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function getBudgetsReport(
  supabase: SupabaseClient,
  userId: string,
  filters: ReportFilters
) {
  const startMonth = filters.startDate.substring(0, 7) + '-01';
  const endMonth = filters.endDate.substring(0, 7) + '-01';

  const [budgetsResult, transactionsResult] = await Promise.all([
    supabase
      .from('budgets')
      .select('amount_planned, month, category_id, categories(name, type)')
      .eq('user_id', userId)
      .gte('month', startMonth)
      .lte('month', endMonth),
    supabase
      .from('transactions')
      .select('amount, posted_at, category_id, categories(type)')
      .eq('user_id', userId)
      .gte('posted_at', filters.startDate)
      .lte('posted_at', filters.endDate),
  ]);

  if (budgetsResult.error) throw budgetsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  interface BudgetWithCategory {
    amount_planned: number; // NUMERIC from DB
    month: string;
    category_id: string;
    categories?: { name: string; type: string } | null;
  }

  interface TxForBudget {
    amount: number; // NUMERIC from DB
    posted_at: string;
    category_id: string | null;
    categories?: { type: string } | null;
  }

  const budgets = budgetsResult.data as unknown as BudgetWithCategory[];
  const transactions = transactionsResult.data as unknown as TxForBudget[];

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.category_id && (tx.categories?.type === 'expense' || tx.amount < 0)) {
      const current = spentByCategory.get(tx.category_id) || 0;
      // Convert NUMERIC to cents
      const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
      spentByCategory.set(tx.category_id, current + amountCents);
    }
  }

  const budgetComparisons: BudgetComparison[] = [];
  let totalBudgeted = 0;
  let totalSpent = 0;

  for (const budget of budgets) {
    const spent = spentByCategory.get(budget.category_id) || 0;
    // Convert NUMERIC to cents
    const budgetedCents = Math.round((budget.amount_planned || 0) * 100);
    const remaining = budgetedCents - spent;
    const percentage = budgetedCents > 0 ? (spent / budgetedCents) * 100 : 0;

    totalBudgeted += budgetedCents;
    totalSpent += Math.min(spent, budgetedCents);

    budgetComparisons.push({
      category: budget.categories?.name || 'Categoria',
      categoryId: budget.category_id,
      budgeted_cents: budgetedCents,
      spent_cents: spent,
      remaining_cents: remaining,
      percentage,
      status: percentage > 100 ? 'over' : percentage > 80 ? 'near' : 'under',
    });
  }

  return {
    data: {
      summary: {
        total_budgeted_cents: totalBudgeted,
        total_spent_cents: totalSpent,
        total_remaining_cents: totalBudgeted - totalSpent,
        overall_percentage: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
      },
      budgets: budgetComparisons.sort((a, b) => b.percentage - a.percentage),
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    },
  };
}

async function getGoalsReport(supabase: SupabaseClient, userId: string, filters: ReportFilters) {
  const { data: goals, error } = await supabase
    .from('goals')
    .select('id, name, target_amount_cents, current_amount_cents, target_date, status, start_date, priority')
    .eq('user_id', userId);

  if (error) throw error;

  const typedGoals = goals as unknown as GoalRow[];

  let totalTarget = 0;
  let totalCurrent = 0;
  let completedCount = 0;
  let activeCount = 0;

  const goalDetails = typedGoals.map((goal) => {
    totalTarget += goal.target_amount_cents;
    totalCurrent += goal.current_amount_cents;
    if (goal.status === 'completed') completedCount++;
    if (goal.status === 'active') activeCount++;

    const progress = goal.target_amount_cents > 0
      ? (goal.current_amount_cents / goal.target_amount_cents) * 100
      : 0;

    const remaining = goal.target_amount_cents - goal.current_amount_cents;

    let daysRemaining: number | null = null;
    let monthlyNeeded: number | null = null;
    if (goal.target_date && goal.status === 'active') {
      const targetDate = new Date(goal.target_date);
      const today = new Date();
      daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      const monthsRemaining = daysRemaining / 30;
      monthlyNeeded = monthsRemaining > 0 ? Math.ceil(remaining / monthsRemaining) : remaining;
    }

    return {
      id: goal.id,
      name: goal.name,
      target_cents: goal.target_amount_cents,
      current_cents: goal.current_amount_cents,
      remaining_cents: remaining,
      progress,
      status: goal.status,
      target_date: goal.target_date,
      days_remaining: daysRemaining,
      monthly_needed_cents: monthlyNeeded,
    };
  });

  return {
    data: {
      summary: {
        total_goals: typedGoals.length,
        active_goals: activeCount,
        completed_goals: completedCount,
        total_target_cents: totalTarget,
        total_current_cents: totalCurrent,
        overall_progress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
      },
      goals: goalDetails.sort((a, b) => b.progress - a.progress),
    },
  };
}

async function getDebtsReport(supabase: SupabaseClient, userId: string, filters: ReportFilters) {
  const { data: debts, error } = await supabase
    .from('debts')
    .select('id, name, total_amount_cents, paid_amount_cents, due_date, status, interest_rate, creditor_name, priority')
    .eq('user_id', userId);

  if (error) throw error;

  const typedDebts = debts as unknown as DebtRow[];

  let totalDebt = 0;
  let totalPaid = 0;
  let activeCount = 0;
  let overdueCount = 0;

  const debtDetails = typedDebts.map((debt) => {
    totalDebt += debt.total_amount_cents;
    totalPaid += debt.paid_amount_cents;
    if (debt.status === 'active') activeCount++;
    if (debt.status === 'overdue') overdueCount++;

    const remaining = debt.total_amount_cents - debt.paid_amount_cents;
    const progress = debt.total_amount_cents > 0
      ? (debt.paid_amount_cents / debt.total_amount_cents) * 100
      : 0;

    let daysUntilDue: number | null = null;
    if (debt.due_date) {
      const dueDate = new Date(debt.due_date);
      const today = new Date();
      daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      id: debt.id,
      name: debt.name,
      total_cents: debt.total_amount_cents,
      paid_cents: debt.paid_amount_cents,
      remaining_cents: remaining,
      progress,
      status: debt.status,
      interest_rate: debt.interest_rate,
      due_date: debt.due_date,
      days_until_due: daysUntilDue,
    };
  });

  return {
    data: {
      summary: {
        total_debts: typedDebts.length,
        active_debts: activeCount,
        overdue_debts: overdueCount,
        total_debt_cents: totalDebt,
        total_paid_cents: totalPaid,
        total_remaining_cents: totalDebt - totalPaid,
        overall_progress: totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0,
      },
      debts: debtDetails.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        return (a.days_until_due ?? 999) - (b.days_until_due ?? 999);
      }),
    },
  };
}

async function getInvestmentsReport(supabase: SupabaseClient, userId: string, filters: ReportFilters) {
  const { data: investments, error } = await supabase
    .from('investments')
    .select('id, name, type, initial_investment_cents, current_value_cents, purchase_date, status, institution')
    .eq('user_id', userId);

  if (error) throw error;

  const typedInvestments = investments as unknown as InvestmentRow[];

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const byType = new Map<string, { invested: number; current: number; count: number }>();

  const investmentDetails = typedInvestments.map((inv) => {
    const currentValue = inv.current_value_cents ?? inv.initial_investment_cents;
    totalInvested += inv.initial_investment_cents;
    totalCurrentValue += currentValue;

    if (!byType.has(inv.type)) {
      byType.set(inv.type, { invested: 0, current: 0, count: 0 });
    }
    const typeData = byType.get(inv.type)!;
    typeData.invested += inv.initial_investment_cents;
    typeData.current += currentValue;
    typeData.count += 1;

    const returnAmount = currentValue - inv.initial_investment_cents;
    const returnPercentage = inv.initial_investment_cents > 0
      ? (returnAmount / inv.initial_investment_cents) * 100
      : 0;

    return {
      id: inv.id,
      name: inv.name,
      type: inv.type,
      invested_cents: inv.initial_investment_cents,
      current_value_cents: currentValue,
      return_cents: returnAmount,
      return_percentage: returnPercentage,
      status: inv.status,
    };
  });

  const byTypeArray = Array.from(byType.entries()).map(([type, data]) => ({
    type,
    invested_cents: data.invested,
    current_value_cents: data.current,
    return_cents: data.current - data.invested,
    return_percentage: data.invested > 0 ? ((data.current - data.invested) / data.invested) * 100 : 0,
    count: data.count,
    allocation_percentage: totalCurrentValue > 0 ? (data.current / totalCurrentValue) * 100 : 0,
  }));

  return {
    data: {
      summary: {
        total_investments: typedInvestments.length,
        total_invested_cents: totalInvested,
        total_current_value_cents: totalCurrentValue,
        total_return_cents: totalCurrentValue - totalInvested,
        total_return_percentage: totalInvested > 0
          ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
          : 0,
      },
      by_type: byTypeArray.sort((a, b) => b.current_value_cents - a.current_value_cents),
      investments: investmentDetails.sort((a, b) => b.current_value_cents - a.current_value_cents),
    },
  };
}

async function getCashflowReport(
  supabase: SupabaseClient,
  userId: string,
  filters: ReportFilters
) {
  let query = supabase
    .from('transactions')
    .select('amount, posted_at, categories(type)')
    .eq('user_id', userId)
    .gte('posted_at', filters.startDate)
    .lte('posted_at', filters.endDate)
    .order('posted_at', { ascending: true });

  if (filters.accountIds?.length) {
    query = query.in('account_id', filters.accountIds);
  }

  const { data: transactions, error } = await query;
  if (error) throw error;

  interface CashflowTx {
    amount: number; // NUMERIC from DB
    posted_at: string;
    categories?: { type: string } | null;
  }

  const typedTransactions = transactions as unknown as CashflowTx[];

  const periodMap = new Map<string, PeriodData>();
  let runningBalance = 0;

  for (const tx of typedTransactions) {
    const periodKey = getPeriodKey(tx.posted_at, filters.groupBy);
    // Convert NUMERIC to cents
    const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
    const isIncome = tx.categories?.type === 'income' || tx.amount > 0;
    const amount = amountCents;

    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        period: periodKey,
        income_cents: 0,
        expense_cents: 0,
        balance_cents: 0,
      });
    }

    const period = periodMap.get(periodKey)!;
    if (isIncome) {
      period.income_cents += amount;
      runningBalance += amount;
    } else {
      period.expense_cents += amount;
      runningBalance -= amount;
    }
    period.balance_cents = runningBalance;
  }

  const periods = Array.from(periodMap.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );

  let cumulativeBalance = 0;
  const cumulativePeriods = periods.map((p) => {
    cumulativeBalance += p.income_cents - p.expense_cents;
    return {
      ...p,
      cumulative_balance_cents: cumulativeBalance,
    };
  });

  return {
    data: {
      periods: cumulativePeriods,
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy,
      },
    },
  };
}

function getPeriodKey(date: string, groupBy: 'day' | 'week' | 'month' | 'year'): string {
  const d = new Date(date);
  switch (groupBy) {
    case 'day':
      return date;
    case 'week': {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    }
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return String(d.getFullYear());
    default:
      return date;
  }
}
