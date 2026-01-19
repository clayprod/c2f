/**
 * Calculate and generate account yield budgets
 * Generates budgets for the month following a period where accounts had positive balances with yield rate
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { DailyBalance } from './overdraftInterest';

export interface AccountYield {
  account_id: string;
  account_name: string;
  yield_cents: number;
}

/**
 * Calculate daily yield rate from monthly rate (compound)
 * Formula: (1 + monthly_rate)^(1/30) - 1
 */
function calculateDailyRate(monthlyRate: number): number {
  if (monthlyRate <= 0) return 0;
  // Convert percentage to decimal (e.g., 0.5% -> 0.005)
  const monthlyDecimal = monthlyRate / 100;
  // Calculate daily rate: (1 + monthly)^(1/30) - 1
  const dailyDecimal = Math.pow(1 + monthlyDecimal, 1 / 30) - 1;
  return dailyDecimal;
}

/**
 * Calculate compound yield for a day
 * Returns yield in cents (rounded)
 */
function calculateDailyYield(balanceCents: number, dailyRate: number): number {
  if (balanceCents <= 0 || dailyRate <= 0) return 0;
  // Yield = balance * daily_rate (compound)
  const yieldDecimal = balanceCents * dailyRate;
  return Math.round(yieldDecimal);
}

/**
 * Reconstruct daily balances for an account in a given period
 * Uses current_balance as anchor and iterates backwards through transactions
 */
async function reconstructDailyBalances(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<DailyBalance[]> {
  const balances: DailyBalance[] = [];
  
  // Get account current balance
  const { data: account } = await supabase
    .from('accounts')
    .select('current_balance')
    .eq('id', accountId)
    .single();

  if (!account) return balances;

  const currentBalanceCents = Math.round((account.current_balance || 0) * 100);

  // Get all transactions for this account in the period
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: transactions } = await supabase
    .from('transactions')
    .select('posted_at, amount')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .gte('posted_at', startDateStr)
    .lte('posted_at', endDateStr)
    .order('posted_at', { ascending: true });

  // Build a map of transactions by date
  const transactionsByDate = new Map<string, number>();
  if (transactions) {
    for (const tx of transactions) {
      const dateStr = tx.posted_at;
      const amountCents = Math.round((tx.amount || 0) * 100);
      const existing = transactionsByDate.get(dateStr) || 0;
      transactionsByDate.set(dateStr, existing + amountCents);
    }
  }

  // Start from end date and work backwards
  // We'll use the current balance as the balance at endDate
  let runningBalanceCents = currentBalanceCents;
  
  // Reverse iterate through dates
  const date = new Date(endDate);
  while (date >= startDate) {
    const dateStr = date.toISOString().split('T')[0];
    
    // Subtract transactions that happened on this date (working backwards)
    const dayTransactions = transactionsByDate.get(dateStr) || 0;
    runningBalanceCents -= dayTransactions;

    balances.unshift({
      date: dateStr,
      balance_cents: runningBalanceCents,
    });

    // Move to previous day
    date.setDate(date.getDate() - 1);
  }

  return balances;
}

/**
 * Calculate account yield for an account in a given period
 */
async function calculateAccountYield(
  supabase: SupabaseClient,
  accountId: string,
  accountName: string,
  userId: string,
  yieldRateMonthly: number,
  startDate: Date,
  endDate: Date
): Promise<AccountYield | null> {
  const dailyBalances = await reconstructDailyBalances(
    supabase,
    accountId,
    userId,
    startDate,
    endDate
  );

  if (dailyBalances.length === 0) return null;

  const dailyRate = calculateDailyRate(yieldRateMonthly);
  let totalYieldCents = 0;

  for (const dayBalance of dailyBalances) {
    // Only calculate yield if balance is positive
    if (dayBalance.balance_cents > 0) {
      const dailyYield = calculateDailyYield(dayBalance.balance_cents, dailyRate);
      totalYieldCents += dailyYield;
    }
  }

  if (totalYieldCents <= 0) return null;

  return {
    account_id: accountId,
    account_name: accountName,
    yield_cents: totalYieldCents,
  };
}

/**
 * Ensure category "Rendimento - Conta" exists, create if not
 */
async function ensureYieldCategory(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // Check if category exists
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Rendimento - Conta')
    .eq('type', 'income')
    .single();

  if (existing) {
    return existing.id;
  }

  // Create category
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: 'Rendimento - Conta',
      type: 'income',
      icon: '💰',
      color: '#32CD32',
      source_type: 'general',
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create yield category: ${error.message}`);
  }

  return newCategory.id;
}

/**
 * Generate account yield budget for a target month
 * Calculates yield from the previous month and creates budget for target month
 * Only creates if budget doesn't already exist
 */
export async function generateAccountYieldBudget(
  supabase: SupabaseClient,
  userId: string,
  targetYear: number,
  targetMonth: number
): Promise<{ created: boolean; budgetId?: string }> {
  // Calculate previous month (the period we're calculating yield for)
  const targetDate = new Date(targetYear, targetMonth - 1, 1);
  const previousMonth = new Date(targetDate);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  
  const previousYear = previousMonth.getFullYear();
  const previousMonthNum = previousMonth.getMonth() + 1;

  const startDate = new Date(previousYear, previousMonthNum - 1, 1);
  const endDate = new Date(previousYear, previousMonthNum, 0); // Last day of previous month

  // Get eligible accounts (have yield rate, exclude credit_card)
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, yield_rate_monthly')
    .eq('user_id', userId)
    .neq('type', 'credit_card')
    .gt('yield_rate_monthly', 0);

  if (!accounts || accounts.length === 0) {
    return { created: false };
  }

  // Calculate yield for each account
  const accountYields: AccountYield[] = [];
  for (const account of accounts) {
    const accountYieldResult = await calculateAccountYield(
      supabase,
      account.id,
      account.name,
      userId,
      account.yield_rate_monthly || 0,
      startDate,
      endDate
    );

    if (accountYieldResult && accountYieldResult.yield_cents > 0) {
      accountYields.push(accountYieldResult);
    }
  }

  if (accountYields.length === 0) {
    return { created: false };
  }

  // Ensure category exists
  const categoryId = await ensureYieldCategory(supabase, userId);

  // Check if budget already exists
  const { data: existingBudget } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('year', targetYear)
    .eq('month', targetMonth)
    .single();

  if (existingBudget) {
    return { created: false, budgetId: existingBudget.id };
  }

  // Calculate total yield
  const totalYieldCents = accountYields.reduce(
    (sum, acc) => sum + acc.yield_cents,
    0
  );

  // Prepare breakdown items
  const breakdownItems = accountYields.map((acc) => ({
    label: acc.account_name,
    amount_cents: acc.yield_cents,
  }));

  // Create budget with breakdown
  const { data: newBudget, error } = await supabase
    .from('budgets')
    .insert({
      user_id: userId,
      category_id: categoryId,
      year: targetYear,
      month: targetMonth,
      amount_planned_cents: totalYieldCents,
      amount_actual: 0,
      source_type: 'manual',
      metadata: {
        budget_breakdown: {
          enabled: true,
          items: breakdownItems,
        },
      },
    })
    .select('id')
    .single();

  if (error) {
    // Try without metadata if column doesn't exist
    if (error.message?.includes('metadata') || error.code === '42703') {
      const { data: fallbackBudget, error: fallbackError } = await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          category_id: categoryId,
          year: targetYear,
          month: targetMonth,
          amount_planned_cents: totalYieldCents,
          amount_actual: 0,
          source_type: 'manual',
        })
        .select('id')
        .single();

      if (fallbackError) {
        throw new Error(`Failed to create account yield budget: ${fallbackError.message}`);
      }

      return { created: true, budgetId: fallbackBudget.id };
    }

    throw new Error(`Failed to create account yield budget: ${error.message}`);
  }

  return { created: true, budgetId: newBudget.id };
}

