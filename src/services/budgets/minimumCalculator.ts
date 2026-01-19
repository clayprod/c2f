/**
 * Calculate minimum budget amount based on automatic contributions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { calculateMonthlyTotal, ContributionFrequency } from '../projections/frequency';

export interface AutoContributionSource {
  type: 'recurring_transaction' | 'goal' | 'debt' | 'investment' | 'credit_card';
  id: string;
  description: string;
  amount_cents: number;
}

/**
 * Calculate minimum amount_planned for a budget category
 * Returns the sum of all automatic contributions
 */
export async function calculateMinimumBudget(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  year: number,
  month: number
): Promise<{
  minimum_cents: number;
  sources: AutoContributionSource[];
}> {
  const sources: AutoContributionSource[] = [];
  let totalCents = 0;

  // 1. Recurring transactions for this category
  const { data: recurringTransactions } = await supabase
    .from('transactions')
    .select('id, description, amount, contribution_frequency, recurrence_rule')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .or('recurrence_rule.not.is.null,contribution_frequency.not.is.null');

  if (recurringTransactions) {
    for (const tx of recurringTransactions) {
      const amountCents = Math.round(Math.abs(parseFloat(tx.amount?.toString() || '0')) * 100);
      
      // Use contribution_frequency if available, otherwise try to parse recurrence_rule
      let frequency: ContributionFrequency = 'monthly';
      if (tx.contribution_frequency) {
        frequency = tx.contribution_frequency as ContributionFrequency;
      } else if (tx.recurrence_rule) {
        // Parse RRULE to determine frequency (simplified)
        if (tx.recurrence_rule.includes('FREQ=DAILY')) {
          frequency = 'daily';
        } else if (tx.recurrence_rule.includes('FREQ=WEEKLY')) {
          frequency = 'weekly';
        } else if (tx.recurrence_rule.includes('FREQ=MONTHLY')) {
          frequency = 'monthly';
        } else if (tx.recurrence_rule.includes('FREQ=YEARLY')) {
          frequency = 'yearly';
        }
      }

      const monthlyCents = calculateMonthlyTotal(amountCents, frequency);
      totalCents += monthlyCents;

      sources.push({
        type: 'recurring_transaction',
        id: tx.id,
        description: tx.description || 'Transação recorrente',
        amount_cents: monthlyCents,
      });
    }
  }

  // 2.1 Custom plan entries for goals in this month
  const entryMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const { data: planEntries } = await supabase
    .from('goal_plan_entries')
    .select('goal_id, amount_cents, description, goal:goals(name)')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('entry_month', entryMonth);

  const goalsWithCustomPlan = new Set(
    (planEntries || []).map((entry) => entry.goal_id)
  );

  if (planEntries) {
    for (const entry of planEntries) {
      const amountCents = entry.amount_cents || 0;
      if (amountCents > 0) {
        totalCents += amountCents;
        sources.push({
          type: 'goal',
          id: entry.goal_id,
          description: entry.description || entry.goal?.[0]?.name || 'Plano personalizado',
          amount_cents: amountCents,
        });
      }
    }
  }

  // 2. Goals with include_in_plan = true
  const { data: goals } = await supabase
    .from('goals')
    .select('id, name, monthly_contribution_cents, contribution_frequency, category_id')
    .eq('user_id', userId)
    .eq('include_in_plan', true)
    .eq('category_id', categoryId)
    .eq('status', 'active');

  if (goals) {
    for (const goal of goals) {
      if (goalsWithCustomPlan.has(goal.id)) {
        continue;
      }

      let monthlyCents = goal.monthly_contribution_cents || 0;
      
      // If frequency is set but monthly_contribution_cents is not, calculate it
      if (goal.contribution_frequency && !monthlyCents) {
        // We'd need the contribution amount to calculate, but for now use monthly_contribution_cents
        // This should be set when the goal is created/updated
      }

      if (monthlyCents > 0) {
        totalCents += monthlyCents;
        sources.push({
          type: 'goal',
          id: goal.id,
          description: goal.name || 'Objetivo',
          amount_cents: monthlyCents,
        });
      }
    }
  }

  // 3. Debts with include_in_plan = true and is_negotiated = true
  const debtEntryMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const { data: debtPlanEntries } = await supabase
    .from('debt_plan_entries')
    .select('debt_id, amount_cents, description, debt:debts(name)')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('entry_month', debtEntryMonth);

  const debtsWithCustomPlan = new Set(
    (debtPlanEntries || []).map((entry) => entry.debt_id)
  );

  if (debtPlanEntries) {
    for (const entry of debtPlanEntries) {
      const amountCents = entry.amount_cents || 0;
      if (amountCents > 0) {
        totalCents += amountCents;
        sources.push({
          type: 'debt',
          id: entry.debt_id,
          description: entry.description || entry.debt?.[0]?.name || 'Plano personalizado',
          amount_cents: amountCents,
        });
      }
    }
  }

  const { data: debts } = await supabase
    .from('debts')
    .select('id, name, monthly_payment_cents, contribution_frequency, category_id')
    .eq('user_id', userId)
    .eq('include_in_plan', true)
    .eq('is_negotiated', true)
    .eq('category_id', categoryId)
    .eq('status', 'negociada');

  if (debts) {
    for (const debt of debts) {
      if (debtsWithCustomPlan.has(debt.id)) {
        continue;
      }

      let monthlyCents = debt.monthly_payment_cents || 0;
      
      if (monthlyCents > 0) {
        totalCents += monthlyCents;
        sources.push({
          type: 'debt',
          id: debt.id,
          description: debt.name || 'Dívida',
          amount_cents: monthlyCents,
        });
      }
    }
  }

  // 4. Investments with include_in_plan = true
  const investmentEntryMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const { data: investmentPlanEntries } = await supabase
    .from('investment_plan_entries')
    .select('investment_id, amount_cents, description, investment:investments(name)')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('entry_month', investmentEntryMonth);

  const investmentsWithCustomPlan = new Set(
    (investmentPlanEntries || []).map((entry) => entry.investment_id)
  );

  if (investmentPlanEntries) {
    for (const entry of investmentPlanEntries) {
      const amountCents = entry.amount_cents || 0;
      if (amountCents > 0) {
        totalCents += amountCents;
        sources.push({
          type: 'investment',
          id: entry.investment_id,
          description: entry.description || entry.investment?.[0]?.name || 'Plano personalizado',
          amount_cents: amountCents,
        });
      }
    }
  }

  const { data: investments } = await supabase
    .from('investments')
    .select('id, name, monthly_contribution_cents, contribution_frequency, category_id')
    .eq('user_id', userId)
    .eq('include_in_plan', true)
    .eq('category_id', categoryId)
    .eq('status', 'active');

  if (investments) {
    for (const investment of investments) {
      if (investmentsWithCustomPlan.has(investment.id)) {
        continue;
      }

      let monthlyCents = investment.monthly_contribution_cents || 0;
      
      if (monthlyCents > 0) {
        totalCents += monthlyCents;
        sources.push({
          type: 'investment',
          id: investment.id,
          description: investment.name || 'Investimento',
          amount_cents: monthlyCents,
        });
      }
    }
  }

  // 5. Credit card bills for this category (from credit_card_bills)
  // Note: This would need to check credit_card_bills table and sum amounts for this category
  // For now, we'll skip this as it requires understanding the credit card bill structure

  return {
    minimum_cents: totalCents,
    sources,
  };
}

/**
 * Format sources for error messages
 */
export function formatSourcesForError(sources: AutoContributionSource[]): string {
  if (sources.length === 0) {
    return '';
  }

  const typeLabels: Record<AutoContributionSource['type'], string> = {
    recurring_transaction: 'Transação recorrente',
    goal: 'Objetivo',
    debt: 'Dívida',
    investment: 'Investimento',
    credit_card: 'Fatura de cartão',
  };

  const grouped = sources.reduce((acc, source) => {
    const type = typeLabels[source.type] || source.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(source.description);
    return acc;
  }, {} as Record<string, string[]>);

  const parts = Object.entries(grouped).map(([type, descriptions]) => {
    const unique = [...new Set(descriptions)];
    return `${type}: ${unique.join(', ')}`;
  });

  return parts.join('; ');
}



