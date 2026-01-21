/**
 * Auto-generate budgets for goals, debts, and investments
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ContributionFrequency, shouldIncludeInMonth, calculateMonthlyTotal } from '../projections/frequency';
import { calculateMonthlyContribution } from '../goals/contributionCalculator';

export interface GenerateBudgetsOptions {
  startMonth: string; // YYYY-MM format
  endMonth: string; // YYYY-MM format
  overwrite?: boolean; // Overwrite existing budgets
}

/**
 * Generate automatic budgets for a goal
 */
export async function generateAutoBudgetsForGoal(
  supabase: SupabaseClient,
  userId: string,
  goal: {
    id: string;
    category_id: string | null;
    include_in_plan: boolean;
    status: string;
    contribution_frequency: string | null;
    contribution_count: number | null;
    monthly_contribution_cents: number | null;
    target_amount_cents: number;
    current_amount_cents: number;
    target_date: string | Date | null;
    start_date: string | Date | null;
  },
  options: GenerateBudgetsOptions
): Promise<{ created: number; updated: number; skipped: number }> {
  // Validate goal can generate budgets
  if (!goal.include_in_plan || goal.status !== 'active') {
    return { created: 0, updated: 0, skipped: 0 };
  }

  if (!goal.category_id) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Check for custom plan entries
  const [rangeStart, rangeEnd] = [
    `${options.startMonth}-01`,
    `${options.endMonth}-31`,
  ];
  const { data: planEntries } = await supabase
    .from('goal_plan_entries')
    .select('entry_month, amount_cents')
    .eq('user_id', userId)
    .eq('goal_id', goal.id)
    .gte('entry_month', rangeStart)
    .lte('entry_month', rangeEnd);

  if (planEntries && planEntries.length > 0) {
    const budgetsToUpsert = planEntries.map((entry) => {
      const entryDate = new Date(entry.entry_month + 'T12:00:00');
      return {
        user_id: userId,
        category_id: goal.category_id,
        year: entryDate.getFullYear(),
        month: entryDate.getMonth() + 1,
        amount_planned_cents: entry.amount_cents,
        amount_actual: 0,
        source_type: 'goal',
        source_id: goal.id,
        is_projected: entryDate > new Date(),
        is_auto_generated: true,
      };
    });

    const { error } = await supabase
      .from('budgets')
      .upsert(budgetsToUpsert, {
        onConflict: 'user_id,category_id,year,month',
      });

    if (error) {
      throw error;
    }

    return {
      created: budgetsToUpsert.length,
      updated: 0,
      skipped: 0,
    };
  }

  if (!goal.contribution_frequency) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Calculate or use monthly contribution
  let monthlyCents = goal.monthly_contribution_cents || 0;
  
  if (!monthlyCents && goal.target_date) {
    const calculated = calculateMonthlyContribution({
      target_amount_cents: goal.target_amount_cents,
      current_amount_cents: goal.current_amount_cents || 0,
      target_date: goal.target_date,
      start_date: goal.start_date,
    });
    
    if (!calculated || calculated <= 0) {
      return { created: 0, updated: 0, skipped: 0 };
    }
    
    monthlyCents = calculated;
  }

  if (monthlyCents <= 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const frequency = goal.contribution_frequency as ContributionFrequency;
  const startDate = goal.start_date 
    ? (typeof goal.start_date === 'string' ? new Date(goal.start_date + 'T12:00:00') : goal.start_date)
    : new Date();
  
  const targetDate = goal.target_date
    ? (typeof goal.target_date === 'string' ? new Date(goal.target_date + 'T12:00:00') : goal.target_date)
    : null;

  // Parse month range
  const [startYear, startMonth] = options.startMonth.split('-').map(Number);
  const [endYear, endMonth] = options.endMonth.split('-').map(Number);

  const budgetsToUpsert: any[] = [];
  let current = new Date(startYear, startMonth - 1, 1);
  let generatedCount = 0;

  while (current <= new Date(endYear, endMonth - 1, 1)) {
    // Check if contribution_count limit is reached
    if (goal.contribution_count && generatedCount >= goal.contribution_count) {
      break;
    }

    // Check if should include this month based on frequency
    if (!shouldIncludeInMonth(frequency, startDate, current)) {
      current.setMonth(current.getMonth() + 1);
      continue;
    }

    // Stop if target date is reached
    if (targetDate && current > targetDate) {
      break;
    }

    // Calculate remaining amount needed
    const remainingAmount = goal.target_amount_cents - (goal.current_amount_cents || 0);
    if (remainingAmount <= 0) {
      break;
    }

    // Use minimum of monthly contribution or remaining amount
    const amountCents = Math.min(monthlyCents, remainingAmount);

    budgetsToUpsert.push({
      user_id: userId,
      category_id: goal.category_id,
      year: current.getFullYear(),
      month: current.getMonth() + 1,
      amount_planned_cents: amountCents,
      amount_actual: 0,
      source_type: 'goal',
      source_id: goal.id,
      is_projected: current > new Date(),
      is_auto_generated: true,
    });

    generatedCount++;
    current.setMonth(current.getMonth() + 1);
  }

  if (budgetsToUpsert.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Check existing budgets
  const existingBudgets = new Map<string, boolean>();
  if (!options.overwrite) {
    const uniqueYears = [...new Set(budgetsToUpsert.map(b => b.year))];
    const { data: existing } = await supabase
      .from('budgets')
      .select('year, month')
      .eq('user_id', userId)
      .eq('category_id', goal.category_id)
      .eq('source_type', 'goal')
      .eq('source_id', goal.id)
      .in('year', uniqueYears);

    if (existing) {
      for (const budget of existing) {
        existingBudgets.set(`${budget.year}-${budget.month}`, true);
      }
    }
  }

  // Filter out existing if not overwriting
  const toInsert = options.overwrite
    ? budgetsToUpsert
    : budgetsToUpsert.filter(b => !existingBudgets.has(`${b.year}-${b.month}`));

  if (toInsert.length === 0) {
    return {
      created: 0,
      updated: 0,
      skipped: budgetsToUpsert.length,
    };
  }

  // Upsert budgets
  const { error } = await supabase
    .from('budgets')
    .upsert(toInsert, {
      onConflict: 'user_id,category_id,year,month',
    });

  if (error) {
    // Try without is_auto_generated if column doesn't exist
    if (error.message?.includes('is_auto_generated') || error.code === '42703') {
      const fallbackBudgets = toInsert.map(({ is_auto_generated, ...rest }) => rest);
      const { error: fallbackError } = await supabase
        .from('budgets')
        .upsert(fallbackBudgets, {
          onConflict: 'user_id,category_id,year,month',
        });
      
      if (fallbackError) throw fallbackError;
    } else {
      throw error;
    }
  }

  const created = toInsert.length;
  const updated = options.overwrite ? budgetsToUpsert.length - created : 0;
  const skipped = budgetsToUpsert.length - created;

  return { created, updated, skipped };
}

/**
 * Generate automatic budgets for a negotiated debt
 */
export async function generateAutoBudgetsForDebt(
  supabase: SupabaseClient,
  userId: string,
  debt: {
    id: string;
    category_id: string | null;
    include_in_plan: boolean;
    is_negotiated: boolean;
    status: string;
    contribution_frequency: string | null;
    contribution_count: number | null;
    monthly_payment_cents: number | null;
    installment_count: number | null;
    installment_amount_cents: number | null;
    installment_day: number | null;
    total_amount_cents: number;
    paid_amount_cents: number;
    start_date: string | Date | null;
  },
  options: GenerateBudgetsOptions
): Promise<{ created: number; updated: number; skipped: number }> {
  // Validate debt can generate budgets
  if (!debt.include_in_plan || !debt.category_id) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Allow budgets for debts with contribution_frequency even if not negotiated
  if (!debt.is_negotiated && !debt.contribution_frequency) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const remainingAmount = debt.total_amount_cents - (debt.paid_amount_cents || 0);
  if (remainingAmount <= 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Parse month range
  const [startYear, startMonth] = options.startMonth.split('-').map(Number);
  const [endYear, endMonth] = options.endMonth.split('-').map(Number);

  const budgetsToUpsert: any[] = [];
  const startDate = debt.start_date
    ? (typeof debt.start_date === 'string' ? new Date(debt.start_date + 'T12:00:00') : debt.start_date)
    : new Date();

  const [rangeStart, rangeEnd] = [
    `${options.startMonth}-01`,
    `${options.endMonth}-31`,
  ];
  const { data: planEntries } = await supabase
    .from('debt_plan_entries')
    .select('entry_month, amount_cents')
    .eq('user_id', userId)
    .eq('debt_id', debt.id)
    .gte('entry_month', rangeStart)
    .lte('entry_month', rangeEnd);

  if (planEntries && planEntries.length > 0) {
    const budgetsToUpsert = planEntries.map((entry) => {
      const entryDate = new Date(entry.entry_month + 'T12:00:00');
      return {
        user_id: userId,
        category_id: debt.category_id,
        year: entryDate.getFullYear(),
        month: entryDate.getMonth() + 1,
        amount_planned_cents: entry.amount_cents,
        amount_actual: 0,
        source_type: 'debt',
        source_id: debt.id,
        is_projected: entryDate > new Date(),
        is_auto_generated: true,
      };
    });

    const { error } = await supabase
      .from('budgets')
      .upsert(budgetsToUpsert, {
        onConflict: 'user_id,category_id,year,month',
      });

    if (error) {
      if (error.message?.includes('is_auto_generated') || error.code === '42703') {
        const fallbackBudgets = budgetsToUpsert.map(({ is_auto_generated, ...rest }) => rest);
        const { error: fallbackError } = await supabase
          .from('budgets')
          .upsert(fallbackBudgets, {
            onConflict: 'user_id,category_id,year,month',
          });

        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }

    return {
      created: budgetsToUpsert.length,
      updated: 0,
      skipped: 0,
    };
  }

      // Use installment system if available
      if (debt.installment_count && debt.installment_amount_cents) {
        const today = new Date();
        const installmentDay = debt.installment_day || 1; // Default to day 1 if not specified
        let installmentNumber = 1;
        let current = new Date(today.getFullYear(), today.getMonth(), installmentDay);

        // Find first installment date
        while (current < startDate) {
          current.setMonth(current.getMonth() + 1);
          installmentNumber++;
        }

        while (installmentNumber <= debt.installment_count && current <= new Date(endYear, endMonth - 1, 1)) {
          const remaining = debt.total_amount_cents - (debt.paid_amount_cents || 0);
          if (remaining <= 0) break;

          const amountCents = Math.min(debt.installment_amount_cents, remaining);

          budgetsToUpsert.push({
            user_id: userId,
            category_id: debt.category_id,
            year: current.getFullYear(),
            month: current.getMonth() + 1,
            amount_planned_cents: amountCents,
            amount_actual: 0,
            source_type: 'debt',
            source_id: debt.id,
            is_projected: current > new Date(),
            is_auto_generated: true,
          });

          current.setMonth(current.getMonth() + 1);
          installmentNumber++;
        }
      }
  // Use frequency-based system
  else if (debt.contribution_frequency && debt.monthly_payment_cents) {
    const frequency = debt.contribution_frequency as ContributionFrequency;
    let current = new Date(startYear, startMonth - 1, 1);
    let generatedCount = 0;

    while (current <= new Date(endYear, endMonth - 1, 1)) {
      // Check if contribution_count limit is reached
      if (debt.contribution_count && generatedCount >= debt.contribution_count) {
        break;
      }

      if (!shouldIncludeInMonth(frequency, startDate, current)) {
        current.setMonth(current.getMonth() + 1);
        continue;
      }

      const remaining = debt.total_amount_cents - (debt.paid_amount_cents || 0);
      if (remaining <= 0) break;

      const amountCents = Math.min(debt.monthly_payment_cents, remaining);

      budgetsToUpsert.push({
        user_id: userId,
        category_id: debt.category_id,
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        amount_planned_cents: amountCents,
        amount_actual: 0,
        source_type: 'debt',
        source_id: debt.id,
        is_projected: current > new Date(),
        is_auto_generated: true,
      });

      generatedCount++;
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    return { created: 0, updated: 0, skipped: 0 };
  }

  if (budgetsToUpsert.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Check existing budgets
  const existingBudgets = new Map<string, boolean>();
  if (!options.overwrite) {
    const uniqueYears = [...new Set(budgetsToUpsert.map(b => b.year))];
    const { data: existing } = await supabase
      .from('budgets')
      .select('year, month')
      .eq('user_id', userId)
      .eq('category_id', debt.category_id)
      .eq('source_type', 'debt')
      .eq('source_id', debt.id)
      .in('year', uniqueYears);

    if (existing) {
      for (const budget of existing) {
        existingBudgets.set(`${budget.year}-${budget.month}`, true);
      }
    }
  }

  // Filter out existing if not overwriting
  const toInsert = options.overwrite
    ? budgetsToUpsert
    : budgetsToUpsert.filter(b => !existingBudgets.has(`${b.year}-${b.month}`));

  if (toInsert.length === 0) {
    return {
      created: 0,
      updated: 0,
      skipped: budgetsToUpsert.length,
    };
  }

  // Upsert budgets
  const { error } = await supabase
    .from('budgets')
    .upsert(toInsert, {
      onConflict: 'user_id,category_id,year,month',
    });

  if (error) {
    // Try without is_auto_generated if column doesn't exist
    if (error.message?.includes('is_auto_generated') || error.code === '42703') {
      const fallbackBudgets = toInsert.map(({ is_auto_generated, ...rest }) => rest);
      const { error: fallbackError } = await supabase
        .from('budgets')
        .upsert(fallbackBudgets, {
          onConflict: 'user_id,category_id,year,month',
        });
      
      if (fallbackError) throw fallbackError;
    } else {
      throw error;
    }
  }

  const created = toInsert.length;
  const updated = options.overwrite ? budgetsToUpsert.length - created : 0;
  const skipped = budgetsToUpsert.length - created;

  return { created, updated, skipped };
}

/**
 * Generate automatic budgets for a negotiated receivable
 */
export async function generateAutoBudgetsForReceivable(
  supabase: SupabaseClient,
  userId: string,
  receivable: {
    id: string;
    category_id: string | null;
    include_in_plan: boolean;
    is_negotiated: boolean;
    status: string;
    contribution_frequency: string | null;
    contribution_count: number | null;
    monthly_payment_cents: number | null;
    installment_count: number | null;
    installment_amount_cents: number | null;
    installment_day: number | null;
    total_amount_cents: number;
    received_amount_cents: number;
    start_date: string | Date | null;
  },
  options: GenerateBudgetsOptions
): Promise<{ created: number; updated: number; skipped: number }> {
  // Validate receivable can generate budgets
  if (!receivable.include_in_plan || !receivable.category_id) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Allow budgets for receivables with contribution_frequency even if not negotiated
  if (!receivable.is_negotiated && !receivable.contribution_frequency) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const remainingAmount = receivable.total_amount_cents - (receivable.received_amount_cents || 0);
  if (remainingAmount <= 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Parse month range
  const [startYear, startMonth] = options.startMonth.split('-').map(Number);
  const [endYear, endMonth] = options.endMonth.split('-').map(Number);

  const budgetsToUpsert: any[] = [];
  const startDate = receivable.start_date
    ? (typeof receivable.start_date === 'string' ? new Date(receivable.start_date + 'T12:00:00') : receivable.start_date)
    : new Date();

  const [rangeStart, rangeEnd] = [
    `${options.startMonth}-01`,
    `${options.endMonth}-31`,
  ];
  const { data: planEntries } = await supabase
    .from('receivable_plan_entries')
    .select('entry_month, amount_cents')
    .eq('user_id', userId)
    .eq('receivable_id', receivable.id)
    .gte('entry_month', rangeStart)
    .lte('entry_month', rangeEnd);

  if (planEntries && planEntries.length > 0) {
    const budgetsToUpsert = planEntries.map((entry) => {
      const entryDate = new Date(entry.entry_month + 'T12:00:00');
      return {
        user_id: userId,
        category_id: receivable.category_id,
        year: entryDate.getFullYear(),
        month: entryDate.getMonth() + 1,
        amount_planned_cents: entry.amount_cents,
        amount_actual: 0,
        source_type: 'receivable',
        source_id: receivable.id,
        is_projected: entryDate > new Date(),
        is_auto_generated: true,
      };
    });

    const { error } = await supabase
      .from('budgets')
      .upsert(budgetsToUpsert, {
        onConflict: 'user_id,category_id,year,month',
      });

    if (error) {
      if (error.message?.includes('is_auto_generated') || error.code === '42703') {
        const fallbackBudgets = budgetsToUpsert.map(({ is_auto_generated, ...rest }) => rest);
        const { error: fallbackError } = await supabase
          .from('budgets')
          .upsert(fallbackBudgets, {
            onConflict: 'user_id,category_id,year,month',
          });

        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }

    return {
      created: budgetsToUpsert.length,
      updated: 0,
      skipped: 0,
    };
  }

      // Use installment system if available
      if (receivable.installment_count && receivable.installment_amount_cents) {
        const today = new Date();
        const installmentDay = receivable.installment_day || 1; // Default to day 1 if not specified
        let installmentNumber = 1;
        let current = new Date(today.getFullYear(), today.getMonth(), installmentDay);

        // Find first installment date
        while (current < startDate) {
          current.setMonth(current.getMonth() + 1);
          installmentNumber++;
        }

        while (installmentNumber <= receivable.installment_count && current <= new Date(endYear, endMonth - 1, 1)) {
          const remaining = receivable.total_amount_cents - (receivable.received_amount_cents || 0);
          if (remaining <= 0) break;

          const amountCents = Math.min(receivable.installment_amount_cents, remaining);

          budgetsToUpsert.push({
            user_id: userId,
            category_id: receivable.category_id,
            year: current.getFullYear(),
            month: current.getMonth() + 1,
            amount_planned_cents: amountCents,
            amount_actual: 0,
            source_type: 'receivable',
            source_id: receivable.id,
            is_projected: current > new Date(),
            is_auto_generated: true,
          });

          current.setMonth(current.getMonth() + 1);
          installmentNumber++;
        }
      }
  // Use frequency-based system
  else if (receivable.contribution_frequency && receivable.monthly_payment_cents) {
    const frequency = receivable.contribution_frequency as ContributionFrequency;
    let current = new Date(startYear, startMonth - 1, 1);
    let generatedCount = 0;

    while (current <= new Date(endYear, endMonth - 1, 1)) {
      // Check if contribution_count limit is reached
      if (receivable.contribution_count && generatedCount >= receivable.contribution_count) {
        break;
      }

      if (!shouldIncludeInMonth(frequency, startDate, current)) {
        current.setMonth(current.getMonth() + 1);
        continue;
      }

      const remaining = receivable.total_amount_cents - (receivable.received_amount_cents || 0);
      if (remaining <= 0) break;

      const amountCents = Math.min(receivable.monthly_payment_cents, remaining);

      budgetsToUpsert.push({
        user_id: userId,
        category_id: receivable.category_id,
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        amount_planned_cents: amountCents,
        amount_actual: 0,
        source_type: 'receivable',
        source_id: receivable.id,
        is_projected: current > new Date(),
        is_auto_generated: true,
      });

      generatedCount++;
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    return { created: 0, updated: 0, skipped: 0 };
  }

  if (budgetsToUpsert.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Check existing budgets
  const existingBudgets = new Map<string, boolean>();
  if (!options.overwrite) {
    const uniqueYears = [...new Set(budgetsToUpsert.map(b => b.year))];
    const { data: existing } = await supabase
      .from('budgets')
      .select('year, month')
      .eq('user_id', userId)
      .eq('category_id', receivable.category_id)
      .eq('source_type', 'receivable')
      .eq('source_id', receivable.id)
      .in('year', uniqueYears);

    if (existing) {
      for (const budget of existing) {
        existingBudgets.set(`${budget.year}-${budget.month}`, true);
      }
    }
  }

  // Filter out existing if not overwriting
  const toInsert = options.overwrite
    ? budgetsToUpsert
    : budgetsToUpsert.filter(b => !existingBudgets.has(`${b.year}-${b.month}`));

  if (toInsert.length === 0) {
    return {
      created: 0,
      updated: 0,
      skipped: budgetsToUpsert.length,
    };
  }

  // Upsert budgets
  const { error } = await supabase
    .from('budgets')
    .upsert(toInsert, {
      onConflict: 'user_id,category_id,year,month',
    });

  if (error) {
    // Try without is_auto_generated if column doesn't exist
    if (error.message?.includes('is_auto_generated') || error.code === '42703') {
      const fallbackBudgets = toInsert.map(({ is_auto_generated, ...rest }) => rest);
      const { error: fallbackError } = await supabase
        .from('budgets')
        .upsert(fallbackBudgets, {
          onConflict: 'user_id,category_id,year,month',
        });
      
      if (fallbackError) throw fallbackError;
    } else {
      throw error;
    }
  }

  const created = toInsert.length;
  const updated = options.overwrite ? budgetsToUpsert.length - created : 0;
  const skipped = budgetsToUpsert.length - created;

  return { created, updated, skipped };
}

/**
 * Generate automatic budgets for an investment
 */
export async function generateAutoBudgetsForInvestment(
  supabase: SupabaseClient,
  userId: string,
  investment: {
    id: string;
    category_id: string | null;
    include_in_plan: boolean;
    status: string;
    contribution_frequency: string | null;
    contribution_count: number | null;
    monthly_contribution_cents: number | null;
    purchase_date: string | Date;
  },
  options: GenerateBudgetsOptions
): Promise<{ created: number; updated: number; skipped: number }> {
  // Validate investment can generate budgets
  if (!investment.include_in_plan || investment.status !== 'active' || !investment.category_id) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Parse month range
  const [startYear, startMonth] = options.startMonth.split('-').map(Number);
  const [endYear, endMonth] = options.endMonth.split('-').map(Number);

  const budgetsToUpsert: any[] = [];
  const [rangeStart, rangeEnd] = [
    `${options.startMonth}-01`,
    `${options.endMonth}-31`,
  ];
  const { data: planEntries } = await supabase
    .from('investment_plan_entries')
    .select('entry_month, amount_cents')
    .eq('user_id', userId)
    .eq('investment_id', investment.id)
    .gte('entry_month', rangeStart)
    .lte('entry_month', rangeEnd);

  if (planEntries && planEntries.length > 0) {
    const budgetsToUpsert = planEntries.map((entry) => {
      const entryDate = new Date(entry.entry_month + 'T12:00:00');
      return {
        user_id: userId,
        category_id: investment.category_id,
        year: entryDate.getFullYear(),
        month: entryDate.getMonth() + 1,
        amount_planned_cents: entry.amount_cents,
        amount_actual: 0,
        source_type: 'investment',
        source_id: investment.id,
        is_projected: entryDate > new Date(),
        is_auto_generated: true,
      };
    });

    const { error } = await supabase
      .from('budgets')
      .upsert(budgetsToUpsert, {
        onConflict: 'user_id,category_id,year,month',
      });

    if (error) {
      if (error.message?.includes('is_auto_generated') || error.code === '42703') {
        const fallbackBudgets = budgetsToUpsert.map(({ is_auto_generated, ...rest }) => rest);
        const { error: fallbackError } = await supabase
          .from('budgets')
          .upsert(fallbackBudgets, {
            onConflict: 'user_id,category_id,year,month',
          });

        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }

    return {
      created: budgetsToUpsert.length,
      updated: 0,
      skipped: 0,
    };
  }

  if (!investment.contribution_frequency || !investment.monthly_contribution_cents) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const monthlyCents = investment.monthly_contribution_cents;
  if (monthlyCents <= 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const frequency = investment.contribution_frequency as ContributionFrequency;
  const purchaseDate = typeof investment.purchase_date === 'string'
    ? new Date(investment.purchase_date + 'T12:00:00')
    : investment.purchase_date;

  let current = new Date(startYear, startMonth - 1, 1);
  let generatedCount = 0;

  while (current <= new Date(endYear, endMonth - 1, 1)) {
    // Check if contribution_count limit is reached
    if (investment.contribution_count && generatedCount >= investment.contribution_count) {
      break;
    }

    // Check if should include this month based on frequency
    if (!shouldIncludeInMonth(frequency, purchaseDate, current)) {
      current.setMonth(current.getMonth() + 1);
      continue;
    }

    budgetsToUpsert.push({
      user_id: userId,
      category_id: investment.category_id,
      year: current.getFullYear(),
      month: current.getMonth() + 1,
      amount_planned_cents: monthlyCents,
      amount_actual: 0,
      source_type: 'investment',
      source_id: investment.id,
      is_projected: current > new Date(),
      is_auto_generated: true,
    });

    generatedCount++;
    current.setMonth(current.getMonth() + 1);
  }

  if (budgetsToUpsert.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  // Check existing budgets
  const existingBudgets = new Map<string, boolean>();
  if (!options.overwrite) {
    const uniqueYears = [...new Set(budgetsToUpsert.map(b => b.year))];
    const { data: existing } = await supabase
      .from('budgets')
      .select('year, month')
      .eq('user_id', userId)
      .eq('category_id', investment.category_id)
      .eq('source_type', 'investment')
      .eq('source_id', investment.id)
      .in('year', uniqueYears);

    if (existing) {
      for (const budget of existing) {
        existingBudgets.set(`${budget.year}-${budget.month}`, true);
      }
    }
  }

  // Filter out existing if not overwriting
  const toInsert = options.overwrite
    ? budgetsToUpsert
    : budgetsToUpsert.filter(b => !existingBudgets.has(`${b.year}-${b.month}`));

  if (toInsert.length === 0) {
    return {
      created: 0,
      updated: 0,
      skipped: budgetsToUpsert.length,
    };
  }

  // Upsert budgets
  const { error } = await supabase
    .from('budgets')
    .upsert(toInsert, {
      onConflict: 'user_id,category_id,year,month',
    });

  if (error) {
    // Try without is_auto_generated if column doesn't exist
    if (error.message?.includes('is_auto_generated') || error.code === '42703') {
      const fallbackBudgets = toInsert.map(({ is_auto_generated, ...rest }) => rest);
      const { error: fallbackError } = await supabase
        .from('budgets')
        .upsert(fallbackBudgets, {
          onConflict: 'user_id,category_id,year,month',
        });
      
      if (fallbackError) throw fallbackError;
    } else {
      throw error;
    }
  }

  const created = toInsert.length;
  const updated = options.overwrite ? budgetsToUpsert.length - created : 0;
  const skipped = budgetsToUpsert.length - created;

  return { created, updated, skipped };
}

/**
 * Recalculate goal budgets after manual adjustment
 */
export async function recalculateGoalBudgets(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  adjustedMonth: string, // YYYY-MM format
  newAmountCents: number
): Promise<{ updated: number }> {
  // Get goal
  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single();

  if (goalError || !goal) {
    throw new Error('Goal not found');
  }

  if (!goal.category_id) {
    throw new Error('Goal has no category');
  }

  const { data: customPlanEntries } = await supabase
    .from('goal_plan_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .limit(1);

  if (customPlanEntries && customPlanEntries.length > 0) {
    // Custom plans are managed explicitly by the user
    return { updated: 0 };
  }

  // Calculate new monthly contribution based on adjusted amount
  const [adjustedYear, adjustedMonthNum] = adjustedMonth.split('-').map(Number);
  const adjustedDate = new Date(adjustedYear, adjustedMonthNum - 1, 1);
  const targetDate = goal.target_date ? new Date(goal.target_date + 'T12:00:00') : null;

  if (!targetDate) {
    throw new Error('Goal has no target date');
  }

  // Calculate months remaining from adjusted month
  const monthsRemaining = Math.max(1, calculateMonthsBetween(adjustedDate, targetDate));
  const remainingAmount = goal.target_amount_cents - (goal.current_amount_cents || 0) - newAmountCents;

  if (remainingAmount <= 0) {
    // Goal will be completed, remove future budgets
    const { error: deleteError } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', goal.category_id)
      .eq('source_type', 'goal')
      .eq('source_id', goalId)
      .gt('year', adjustedYear)
      .or(`year.eq.${adjustedYear},month.gt.${adjustedMonthNum}`);

    if (deleteError) throw deleteError;

    // Update goal monthly contribution to 0
    await supabase
      .from('goals')
      .update({ monthly_contribution_cents: 0 })
      .eq('id', goalId);

    return { updated: 0 };
  }

  const newMonthlyCents = Math.ceil(remainingAmount / monthsRemaining);

  // Update goal monthly contribution
  await supabase
    .from('goals')
    .update({ monthly_contribution_cents: newMonthlyCents })
    .eq('id', goalId);

  // Get all future budgets for this goal
  const { data: futureBudgets } = await supabase
    .from('budgets')
    .select('id, year, month')
    .eq('user_id', userId)
    .eq('category_id', goal.category_id)
    .eq('source_type', 'goal')
    .eq('source_id', goalId)
    .or(`year.gt.${adjustedYear},and(year.eq.${adjustedYear},month.gt.${adjustedMonthNum})`)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  if (!futureBudgets || futureBudgets.length === 0) {
    return { updated: 0 };
  }

  // Recalculate each future budget
  let remaining = remainingAmount;
  let updated = 0;

  for (const budget of futureBudgets) {
    if (remaining <= 0) {
      // Delete remaining budgets
      await supabase
        .from('budgets')
        .delete()
        .eq('id', budget.id);
      continue;
    }

    const amountCents = Math.min(newMonthlyCents, remaining);
    remaining -= amountCents;

    const { error: updateError } = await supabase
      .from('budgets')
    .update({ amount_planned_cents: amountCents })
      .eq('id', budget.id);

    if (updateError) throw updateError;
    updated++;
  }

  return { updated };
}

function calculateMonthsBetween(startDate: Date, endDate: Date): number {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  const monthsDiff = (endYear - startYear) * 12 + (endMonth - startMonth);

  if (endDate.getDate() >= startDate.getDate()) {
    return Math.max(1, monthsDiff);
  }

  return Math.max(1, monthsDiff - 1);
}

