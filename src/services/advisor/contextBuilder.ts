/**
 * Financial Context Builder
 * Builds a consolidated JSON context of user's financial data for the AI Advisor
 */

import { createClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/services/stripe/subscription';
import { FinancialContext } from './types';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Build complete financial context for a user
 * Optimized to minimize tokens while providing comprehensive data
 */
export async function buildFinancialContext(userId: string): Promise<FinancialContext> {
  const supabase = await createClient();
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6);
  const currentMonth = format(now, 'yyyy-MM');
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  // Fetch all data in parallel for performance
  const [
    profileResult,
    accountsResult,
    transactionsResult,
    categoriesResult,
    budgetsResult,
    goalsResult,
    debtsResult,
    investmentsResult,
    assetsResult,
    creditCardBillsResult,
    planResult,
  ] = await Promise.all([
    // User profile
    supabase.from('profiles').select('id, full_name, created_at').eq('id', userId).single(),

    // Accounts
    supabase.from('accounts').select('*').eq('user_id', userId),

    // Transactions (last 6 months, aggregated)
    supabase
      .from('transactions')
      .select('id, amount, posted_at, category_id, account_id')
      .eq('user_id', userId)
      .gte('posted_at', format(sixMonthsAgo, 'yyyy-MM-dd'))
      .order('posted_at', { ascending: false }),

    // Categories
    supabase.from('categories').select('*').eq('user_id', userId).eq('is_active', true),

    // Budgets (current and next month)
    supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .gte('year', currentYear - 1),

    // Goals
    supabase.from('goals').select('*').eq('user_id', userId).in('status', ['active', 'completed']),

    // Debts
    supabase.from('debts').select('*').eq('user_id', userId).neq('status', 'paid'),

    // Investments
    supabase.from('investments').select('*').eq('user_id', userId).eq('status', 'active'),

    // Assets
    supabase.from('assets').select('*').eq('user_id', userId).eq('status', 'active'),

    // Credit card bills (upcoming)
    supabase
      .from('credit_card_bills')
      .select('*, accounts!inner(name)')
      .eq('user_id', userId)
      .in('status', ['open', 'closed', 'partial'])
      .order('due_date', { ascending: true })
      .limit(10),

    // User plan
    getUserPlan(userId).catch(() => ({ plan: 'free', status: 'active' })),
  ]);

  const profile = profileResult.data;
  const accounts = accountsResult.data || [];
  const transactions = transactionsResult.data || [];
  const categories = categoriesResult.data || [];
  const budgets = budgetsResult.data || [];
  const goals = goalsResult.data || [];
  const debts = debtsResult.data || [];
  const investments = investmentsResult.data || [];
  const assets = assetsResult.data || [];
  const creditCardBills = creditCardBillsResult.data || [];

  // Calculate aggregations
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Aggregate transactions by category and month
  const categoryAggregates = aggregateByCategory(transactions, categoryMap, sixMonthsAgo);
  const monthlyHistory = aggregateByMonth(transactions, categoryMap, sixMonthsAgo);

  // Calculate totals
  const totalAssets = accounts
    .filter(a => a.type !== 'credit_card' && a.type !== 'credit')
    .reduce((sum, a) => sum + (parseFloat(a.current_balance) || 0), 0) +
    assets.reduce((sum, a) => sum + (a.current_value_cents || 0) / 100, 0) +
    investments.reduce((sum, i) => sum + (i.current_value_cents || 0) / 100, 0);

  const totalLiabilities = debts.reduce((sum, d) => sum + (d.remaining_amount_cents || 0) / 100, 0) +
    creditCardBills.reduce((sum, b) => sum + ((b.total_cents || 0) - (b.paid_cents || 0)) / 100, 0);

  const netWorth = totalAssets - totalLiabilities;

  // Current month income/expenses
  const currentMonthTxs = transactions.filter(t =>
    t.posted_at && t.posted_at.startsWith(currentMonth)
  );
  const monthlyIncome = currentMonthTxs
    .filter(t => {
      const cat = categoryMap.get(t.category_id);
      return cat?.type === 'income';
    })
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

  const monthlyExpenses = currentMonthTxs
    .filter(t => {
      const cat = categoryMap.get(t.category_id);
      return cat?.type === 'expense';
    })
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  // Generate alerts
  const alerts = generateAlerts(budgets, goals, debts, creditCardBills, savingsRate, currentYear, currentMonthNum);

  // Build context object
  const context: FinancialContext = {
    user: {
      id: userId,
      name: profile?.full_name || null,
      plan: planResult.plan || 'free',
      created_at: profile?.created_at || new Date().toISOString(),
    },
    snapshot: {
      net_worth: Math.round(netWorth * 100) / 100,
      total_assets: Math.round(totalAssets * 100) / 100,
      total_liabilities: Math.round(totalLiabilities * 100) / 100,
      monthly_income: Math.round(monthlyIncome * 100) / 100,
      monthly_expenses: Math.round(monthlyExpenses * 100) / 100,
      savings_rate: Math.round(savingsRate * 100) / 100,
    },
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: parseFloat(a.current_balance) || 0,
      ...(a.type === 'credit_card' && {
        credit_limit: (a.credit_limit_cents || 0) / 100,
        utilization: a.credit_limit_cents > 0
          ? ((a.credit_limit_cents - (a.available_limit_cents || 0)) / a.credit_limit_cents) * 100
          : 0,
      }),
    })),
    categories_summary: categoryAggregates,
    monthly_history: monthlyHistory,
    budgets: budgets
      .filter(b => b.year === currentYear && b.month === currentMonthNum)
      .map(b => {
        const cat = categoryMap.get(b.category_id);
        const planned = parseFloat(b.amount_planned) || 0;
        const actual = parseFloat(b.amount_actual) || 0;
        return {
          id: b.id,
          category: cat?.name || 'Desconhecida',
          year: b.year,
          month: b.month,
          planned,
          actual,
          variance: actual - planned,
          is_over: actual > planned,
        };
      }),
    goals: goals.map(g => {
      const target = (g.target_amount_cents || 0) / 100;
      const current = (g.current_amount_cents || 0) / 100;
      const progressPct = target > 0 ? (current / target) * 100 : 0;

      // Calculate if on track based on target date
      let onTrack = true;
      if (g.target_date) {
        const daysToTarget = Math.ceil((new Date(g.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const remaining = target - current;
        const dailyNeeded = daysToTarget > 0 ? remaining / daysToTarget : remaining;
        const monthlyNeeded = dailyNeeded * 30;
        onTrack = monthlyNeeded <= (g.monthly_contribution_cents || 0) / 100 * 1.2; // 20% margin
      }

      return {
        id: g.id,
        name: g.name,
        target,
        current,
        progress_pct: Math.round(progressPct * 100) / 100,
        target_date: g.target_date,
        on_track: onTrack,
        status: g.status,
      };
    }),
    debts: debts.map(d => ({
      id: d.id,
      name: d.name,
      remaining: (d.remaining_amount_cents || d.total_amount_cents - (d.paid_amount_cents || 0)) / 100,
      interest_rate: parseFloat(d.interest_rate) || 0,
      due_date: d.due_date,
      status: d.status,
      priority: d.priority || 'medium',
    })),
    investments: investments.map(i => {
      const initial = (i.initial_investment_cents || 0) / 100;
      const current = (i.current_value_cents || 0) / 100;
      const roi = initial > 0 ? ((current - initial) / initial) * 100 : 0;
      return {
        id: i.id,
        name: i.name,
        type: i.type,
        current_value: current,
        initial_value: initial,
        roi: Math.round(roi * 100) / 100,
      };
    }),
    assets: assets.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      current_value: (a.current_value_cents || 0) / 100,
    })),
    credit_cards: creditCardBills.map(b => ({
      id: b.account_id,
      name: (b as any).accounts?.name || 'Cartão',
      limit: 0, // Would need to join with accounts for this
      available: 0,
      utilization_pct: 0,
      next_due: b.due_date,
    })),
    alerts,
  };

  return context;
}

/**
 * Aggregate transactions by category for the last 6 months
 */
function aggregateByCategory(
  transactions: any[],
  categoryMap: Map<string, any>,
  since: Date
): FinancialContext['categories_summary'] {
  const categoryTotals = new Map<string, { total: number; months: Map<string, number> }>();

  for (const tx of transactions) {
    if (!tx.category_id) continue;
    const cat = categoryMap.get(tx.category_id);
    if (!cat) continue;

    const amount = Math.abs(parseFloat(tx.amount) || 0);
    const month = tx.posted_at?.substring(0, 7) || '';

    if (!categoryTotals.has(tx.category_id)) {
      categoryTotals.set(tx.category_id, { total: 0, months: new Map() });
    }

    const catData = categoryTotals.get(tx.category_id)!;
    catData.total += amount;
    catData.months.set(month, (catData.months.get(month) || 0) + amount);
  }

  return Array.from(categoryTotals.entries()).map(([catId, data]) => {
    const cat = categoryMap.get(catId)!;
    const monthValues = Array.from(data.months.values());
    const avgMonthly = monthValues.length > 0 ? data.total / monthValues.length : 0;

    // Calculate trend (compare last 2 months if available)
    const sortedMonths = Array.from(data.months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (sortedMonths.length >= 2) {
      const recent = sortedMonths[0][1];
      const previous = sortedMonths[1][1];
      if (recent > previous * 1.1) trend = 'up';
      else if (recent < previous * 0.9) trend = 'down';
    }

    return {
      id: catId,
      name: cat.name,
      type: cat.type,
      total_6_months: Math.round(data.total * 100) / 100,
      avg_monthly: Math.round(avgMonthly * 100) / 100,
      trend,
    };
  }).sort((a, b) => b.total_6_months - a.total_6_months);
}

/**
 * Aggregate transactions by month
 */
function aggregateByMonth(
  transactions: any[],
  categoryMap: Map<string, any>,
  since: Date
): FinancialContext['monthly_history'] {
  const monthlyData = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const month = tx.posted_at?.substring(0, 7) || '';
    if (!month) continue;

    const amount = Math.abs(parseFloat(tx.amount) || 0);
    const cat = categoryMap.get(tx.category_id);
    const isIncome = cat?.type === 'income';

    if (!monthlyData.has(month)) {
      monthlyData.set(month, { income: 0, expenses: 0 });
    }

    const data = monthlyData.get(month)!;
    if (isIncome) {
      data.income += amount;
    } else {
      data.expenses += amount;
    }
  }

  return Array.from(monthlyData.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([month, data]) => ({
      year_month: month,
      income: Math.round(data.income * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      balance: Math.round((data.income - data.expenses) * 100) / 100,
    }));
}

/**
 * Generate automatic alerts based on financial data
 */
function generateAlerts(
  budgets: any[],
  goals: any[],
  debts: any[],
  creditCardBills: any[],
  savingsRate: number,
  currentYear: number,
  currentMonth: number
): FinancialContext['alerts'] {
  const alerts: FinancialContext['alerts'] = [];

  // Budget alerts
  const currentBudgets = budgets.filter(b => b.year === currentYear && b.month === currentMonth);
  for (const budget of currentBudgets) {
    const planned = parseFloat(budget.amount_planned) || 0;
    const actual = parseFloat(budget.amount_actual) || 0;
    if (planned > 0 && actual > planned) {
      const overPercent = ((actual - planned) / planned) * 100;
      alerts.push({
        type: 'budget_exceeded',
        message: `Orçamento ultrapassado em ${overPercent.toFixed(0)}%`,
        severity: overPercent > 50 ? 'high' : overPercent > 20 ? 'medium' : 'low',
      });
    } else if (planned > 0 && actual > planned * 0.9) {
      alerts.push({
        type: 'budget_warning',
        message: `Orçamento próximo do limite (${((actual / planned) * 100).toFixed(0)}%)`,
        severity: 'medium',
      });
    }
  }

  // Debt alerts
  const now = new Date();
  for (const debt of debts) {
    if (debt.due_date) {
      const dueDate = new Date(debt.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue < 0) {
        alerts.push({
          type: 'debt_overdue',
          message: `Dívida "${debt.name}" vencida há ${Math.abs(daysUntilDue)} dias`,
          severity: 'high',
        });
      } else if (daysUntilDue <= 7) {
        alerts.push({
          type: 'debt_due_soon',
          message: `Dívida "${debt.name}" vence em ${daysUntilDue} dias`,
          severity: 'medium',
        });
      }
    }

    if (debt.interest_rate && parseFloat(debt.interest_rate) > 5) {
      alerts.push({
        type: 'high_interest_debt',
        message: `Dívida "${debt.name}" com juros altos (${debt.interest_rate}%)`,
        severity: parseFloat(debt.interest_rate) > 10 ? 'high' : 'medium',
      });
    }
  }

  // Credit card alerts
  for (const bill of creditCardBills) {
    if (bill.due_date) {
      const dueDate = new Date(bill.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue >= 0 && daysUntilDue <= 5) {
        const amount = ((bill.total_cents || 0) - (bill.paid_cents || 0)) / 100;
        if (amount > 0) {
          alerts.push({
            type: 'card_due_soon',
            message: `Fatura de R$ ${amount.toFixed(2)} vence em ${daysUntilDue} dias`,
            severity: daysUntilDue <= 2 ? 'high' : 'medium',
          });
        }
      }
    }
  }

  // Savings rate alert
  if (savingsRate < 0) {
    alerts.push({
      type: 'negative_savings',
      message: 'Gastos excedem a renda este mês',
      severity: 'high',
    });
  } else if (savingsRate < 10) {
    alerts.push({
      type: 'low_savings',
      message: `Taxa de poupança baixa (${savingsRate.toFixed(1)}%)`,
      severity: 'medium',
    });
  }

  // Goal alerts
  for (const goal of goals) {
    if (goal.status === 'active' && goal.target_date) {
      const targetDate = new Date(goal.target_date);
      const daysToTarget = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const progress = goal.target_amount_cents > 0
        ? (goal.current_amount_cents || 0) / goal.target_amount_cents
        : 0;

      if (daysToTarget > 0 && daysToTarget < 30 && progress < 0.9) {
        alerts.push({
          type: 'goal_at_risk',
          message: `Meta "${goal.name}" com prazo próximo e ${(progress * 100).toFixed(0)}% concluído`,
          severity: 'high',
        });
      }
    }
  }

  return alerts.slice(0, 10); // Limit to 10 most relevant alerts
}

/**
 * Generate a hash of the financial context for change detection
 */
export function hashContext(context: FinancialContext): string {
  const key = JSON.stringify({
    snapshot: context.snapshot,
    alerts: context.alerts.length,
    budgets: context.budgets.map(b => `${b.category}:${b.actual}`).join(','),
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
