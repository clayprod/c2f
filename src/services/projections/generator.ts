import { SupabaseClient } from '@supabase/supabase-js';
import {
  ContributionFrequency,
  calculateMonthlyTotal,
  shouldIncludeInMonth,
  getFrequencyLabel
} from './frequency';

export interface ProjectionItem {
  id: string;
  type: 'credit_card_bill' | 'goal_contribution' | 'debt_payment' | 'investment_contribution' | 'installment' | 'receivable_payment' | 'overdraft_interest' | 'account_yield';
  date: string; // YYYY-MM-DD
  description: string;
  amount_cents: number;
  category_id?: string;
  category_name?: string;
  source_type: 'credit_card' | 'goal' | 'debt' | 'installment' | 'investment' | 'receivable' | 'overdraft' | 'yield';
  source_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectionResult {
  projections: ProjectionItem[];
  monthlyTotals: Record<string, { income: number; expenses: number }>;
  errors?: string[];
}

const MAX_PROJECTION_MONTHS = 120; // 10 years
const BATCH_SIZE = 12; // Process 12 months at a time
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Generate financial projections for a given period
 */
export async function generateProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ProjectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const projections: ProjectionItem[] = [];

  // Validate period
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  if (monthsDiff > MAX_PROJECTION_MONTHS) {
    throw new Error(`Período máximo de projeção é ${MAX_PROJECTION_MONTHS} meses (10 anos)`);
  }

  if (startDate > endDate) {
    throw new Error('Data inicial deve ser anterior à data final');
  }

  // Check timeout periodically
  const checkTimeout = () => {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout ao gerar projeções. Dados parciais podem estar disponíveis.');
    }
  };

  // Fetch realized payments first
  const realizedMap = await fetchRealizedPayments(supabase, userId, startDate, endDate);

  try {
    // 1. Credit card bills
    try {
      checkTimeout();
      const creditCardProjections = await getCreditCardProjections(supabase, userId, startDate, endDate);
      projections.push(...creditCardProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de cartões: ${error.message}`);
    }

    // 2. Goals with monthly contributions
    try {
      checkTimeout();
      const goalProjections = await getGoalProjections(supabase, userId, startDate, endDate, realizedMap.goals);
      projections.push(...goalProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de objetivos: ${error.message}`);
    }

    // 3. Negotiated debts
    try {
      checkTimeout();
      const debtProjections = await getDebtProjections(supabase, userId, startDate, endDate, realizedMap.debts);
      projections.push(...debtProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de dívidas: ${error.message}`);
    }

    // 4. Recurring transactions - REMOVED
    // Recurring transactions are now handled via budgets, goals, debts, and investments
    // No need to project them separately

    // 5. Receivables
    try {
      checkTimeout();
      const receivableProjections = await getReceivableProjections(supabase, userId, startDate, endDate, realizedMap.receivables);
      projections.push(...receivableProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de recebíveis: ${error.message}`);
    }

    // 6. Installment transactions
    try {
      checkTimeout();
      const installmentProjections = await getInstallmentProjections(supabase, userId, startDate, endDate);
      projections.push(...installmentProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de parcelas: ${error.message}`);
    }

    // 6. Investment contributions
    try {
      checkTimeout();
      const investmentProjections = await getInvestmentProjections(supabase, userId, startDate, endDate, realizedMap.investments);
      projections.push(...investmentProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de investimentos: ${error.message}`);
    }

    // 7. Overdraft interest projections
    try {
      checkTimeout();
      const overdraftProjections = await getOverdraftInterestProjections(supabase, userId, startDate, endDate, projections);
      projections.push(...overdraftProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de juros de cheque especial: ${error.message}`);
    }

    // 8. Account yield projections
    try {
      checkTimeout();
      const yieldProjections = await getAccountYieldProjections(supabase, userId, startDate, endDate, projections);
      projections.push(...yieldProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de rendimento: ${error.message}`);
    }

  } catch (error: any) {
    if (error.message.includes('Timeout')) {
      // Return partial results if timeout
      return {
        projections,
        monthlyTotals: groupByMonth(projections),
        errors: [...errors, error.message],
      };
    }
    throw error;
  }

  // Group by month and calculate totals
  const monthlyTotals = groupByMonth(projections);

  return {
    projections,
    monthlyTotals,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Fetch realized payments map
 */
async function fetchRealizedPayments(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const result = {
    goals: new Map<string, Set<string>>(), // goal_id -> Set<yyyy-mm>
    debts: new Map<string, Set<string>>(), // debt_id -> Set<yyyy-mm>
    investments: new Map<string, Set<string>>(), // investment_id -> Set<yyyy-mm>
    receivables: new Map<string, Set<string>>() // receivable_id -> Set<yyyy-mm>
  };

  // 1. Fetch Goal Contributions
  const { data: goalContribs } = await supabase
    .from('goal_contributions')
    .select('goal_id, contribution_date')
    .eq('user_id', userId)
    .gte('contribution_date', startDateStr)
    .lte('contribution_date', endDateStr);

  if (goalContribs) {
    goalContribs.forEach(c => {
      const date = new Date(c.contribution_date + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!result.goals.has(c.goal_id)) result.goals.set(c.goal_id, new Set());
      result.goals.get(c.goal_id)?.add(monthKey);
    });
  }

  // 2. Fetch Debt Payments
  const { data: debtPayments } = await supabase
    .from('debt_payments')
    .select('debt_id, payment_date')
    .eq('user_id', userId)
    .gte('payment_date', startDateStr)
    .lte('payment_date', endDateStr);

  if (debtPayments) {
    debtPayments.forEach(p => {
      const date = new Date(p.payment_date + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!result.debts.has(p.debt_id)) result.debts.set(p.debt_id, new Set());
      result.debts.get(p.debt_id)?.add(monthKey);
    });
  }

  // 3. Fetch Investment Transactions (Contributions)
  const { data: investTx } = await supabase
    .from('investment_transactions')
    .select('investment_id, transaction_date')
    .eq('user_id', userId)
    .eq('type', 'buy') // Only contributions
    .gte('transaction_date', startDateStr)
    .lte('transaction_date', endDateStr);

  if (investTx) {
    investTx.forEach(t => {
      const date = new Date(t.transaction_date + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!result.investments.has(t.investment_id)) result.investments.set(t.investment_id, new Set());
      result.investments.get(t.investment_id)?.add(monthKey);
    });
  }

  // 4. Fetch Receivable Payments
  const { data: receivablePayments } = await supabase
    .from('receivable_payments')
    .select('receivable_id, payment_date')
    .eq('user_id', userId)
    .gte('payment_date', startDateStr)
    .lte('payment_date', endDateStr);

  if (receivablePayments) {
    receivablePayments.forEach(p => {
      const date = new Date(p.payment_date + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!result.receivables.has(p.receivable_id)) result.receivables.set(p.receivable_id, new Set());
      result.receivables.get(p.receivable_id)?.add(monthKey);
    });
  }

  return result;
}

/**
 * Get receivable projections
 */
async function getReceivableProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  realizedReceivables?: Map<string, Set<string>>
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: receivables, error } = await supabase
    .from('receivables')
    .select(`
      id,
      name,
      description,
      total_amount_cents,
      received_amount_cents,
      start_date,
      monthly_payment_cents,
      contribution_frequency,
      installment_amount_cents,
      installment_count,
      current_installment,
      installment_day,
      include_in_plan,
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('is_negotiated', true)
    .eq('status', 'negociada');

  if (error) throw error;

  const { data: planEntries } = await supabase
    .from('receivable_plan_entries')
    .select('receivable_id, entry_month, amount_cents, description, category_id')
    .eq('user_id', userId)
    .gte('entry_month', startDateStr)
    .lte('entry_month', endDateStr);

  const planEntriesByReceivable = new Map<string, typeof planEntries>();
  if (planEntries) {
    for (const entry of planEntries) {
      const list = planEntriesByReceivable.get(entry.receivable_id) || [];
      list.push(entry);
      planEntriesByReceivable.set(entry.receivable_id, list);
    }
  }

  if (receivables) {
    for (const rec of receivables) {
      if (!rec.include_in_plan) continue;
      const remainingAmount = rec.total_amount_cents - (rec.received_amount_cents || 0);
      if (remainingAmount <= 0) continue;

      const recStartDate = rec.start_date ? new Date(rec.start_date + 'T12:00:00') : new Date();

      const customEntries = planEntriesByReceivable.get(rec.id);
      if (customEntries && customEntries.length > 0) {
        for (const entry of customEntries) {
          const entryDate = new Date(entry.entry_month + 'T12:00:00');
          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

          if (realizedReceivables?.get(rec.id)?.has(monthKey)) {
            continue;
          }

          const category = rec.category as any;
          projections.push({
            id: `receivable-${rec.id}-${monthKey}`,
            type: 'receivable_payment',
            date: entry.entry_month,
            description: entry.description || `Plano personalizado - ${rec.name}`,
            amount_cents: Math.abs(entry.amount_cents),
            category_id: entry.category_id || rec.category_id || undefined,
            category_name: category?.name || 'RECEBÍVEIS',
            source_type: 'receivable',
            source_id: rec.id,
            metadata: {
              receivable_id: rec.id,
              receivable_name: rec.name,
              frequency: 'custom',
            },
          });
        }
        continue;
      }

      if (rec.contribution_frequency && rec.monthly_payment_cents) {
        const frequency = rec.contribution_frequency as ContributionFrequency;
        let current = new Date(startDate);
        current.setDate(1);

        while (current <= endDate) {
          if (!shouldIncludeInMonth(frequency, recStartDate, current)) {
            current.setMonth(current.getMonth() + 1);
            continue;
          }

          const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          if (realizedReceivables?.get(rec.id)?.has(monthKey)) {
            current.setMonth(current.getMonth() + 1);
            continue;
          }

          const remaining = rec.total_amount_cents - (rec.received_amount_cents || 0);
          if (remaining <= 0) break;

          const category = rec.category as any;
          const paymentAmount = Math.min(rec.monthly_payment_cents, remaining);

          projections.push({
            id: `receivable-${rec.id}-${current.getFullYear()}-${current.getMonth() + 1}`,
            type: 'receivable_payment',
            date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(rec.installment_day || 1).padStart(2, '0')}`,
            description: `Recebimento ${getFrequencyLabel(frequency)} - ${rec.name}`,
            amount_cents: Math.abs(paymentAmount),
            category_id: rec.category_id || undefined,
            category_name: category?.name || 'RECEBÍVEIS',
            source_type: 'receivable',
            source_id: rec.id,
            metadata: {
              receivable_id: rec.id,
              receivable_name: rec.name,
              frequency: frequency,
              total_remaining: remaining,
            },
          });

          current.setMonth(current.getMonth() + 1);
        }
      } else if (rec.installment_amount_cents && rec.installment_count && rec.installment_day) {
        const currentInstallment = rec.current_installment || 1;
        const remainingInstallments = rec.installment_count - currentInstallment + 1;
        const today = new Date();

        for (let i = 0; i < remainingInstallments; i++) {
          const installmentDate = new Date(today.getFullYear(), today.getMonth() + i, rec.installment_day);
          if (installmentDate > endDate) break;
          if (installmentDate < startDate) continue;

          const category = rec.category as any;

          projections.push({
            id: `receivable-${rec.id}-inst-${currentInstallment + i}`,
            type: 'receivable_payment',
            date: installmentDate.toISOString().split('T')[0],
            description: `${rec.name} (${currentInstallment + i}/${rec.installment_count})`,
            amount_cents: Math.abs(rec.installment_amount_cents),
            category_id: rec.category_id || undefined,
            category_name: category?.name || 'RECEBÍVEIS',
            source_type: 'receivable',
            source_id: rec.id,
            metadata: {
              receivable_id: rec.id,
              receivable_name: rec.name,
              installment_number: currentInstallment + i,
              installment_total: rec.installment_count,
              total_remaining: remainingAmount,
            },
          });
        }
      }
    }
  }

  return projections;
}

/**
 * Get credit card bill projections
 */
async function getCreditCardProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: bills, error } = await supabase
    .from('credit_card_bills')
    .select(`
      id,
      reference_month,
      due_date,
      total_cents,
      paid_cents,
      status,
      account:accounts!credit_card_bills_account_id_fkey(
        id,
        name,
        icon,
        color
      )
    `)
    .eq('user_id', userId)
    .gte('due_date', startDateStr)
    .lte('due_date', endDateStr)
    .neq('status', 'paid')
    .order('due_date', { ascending: true });

  if (error) throw error;

  if (bills) {
    for (const bill of bills) {
      const remainingAmount = bill.total_cents - (bill.paid_cents || 0);
      if (remainingAmount > 0) {
        const referenceDate = new Date(bill.reference_month + 'T12:00:00');
        const monthName = referenceDate.toLocaleDateString('pt-BR', { month: 'long' });
        const account = bill.account as any;

        projections.push({
          id: `bill-${bill.id}`,
          type: 'credit_card_bill',
          date: bill.due_date,
          description: `Fatura ${account?.name || 'Cartão'} - ${monthName}`,
          amount_cents: -remainingAmount,
          source_type: 'credit_card',
          source_id: bill.id,
          metadata: {
            bill_id: bill.id,
            card_id: account?.id,
            card_name: account?.name,
            card_icon: account?.icon,
            card_color: account?.color,
            status: bill.status,
            total_cents: bill.total_cents,
            paid_cents: bill.paid_cents,
          },
        });
      }
    }
  }

  return projections;
}

/**
 * Get goal contribution projections
 */
async function getGoalProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  realizedGoals?: Map<string, Set<string>>
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: goals, error } = await supabase
    .from('goals')
    .select(`
      id,
      name,
      description,
      target_amount_cents,
      current_amount_cents,
      target_date,
      start_date,
      monthly_contribution_cents,
      contribution_frequency,
      contribution_day,
      include_in_plan,
      icon,
      color,
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('include_in_plan', true);

  if (error) throw error;

  const { data: planEntries } = await supabase
    .from('goal_plan_entries')
    .select('goal_id, entry_month, amount_cents, description, category_id')
    .eq('user_id', userId)
    .gte('entry_month', startDateStr)
    .lte('entry_month', endDateStr);

  const planEntriesByGoal = new Map<string, typeof planEntries>();
  if (planEntries) {
    for (const entry of planEntries) {
      const list = planEntriesByGoal.get(entry.goal_id) || [];
      list.push(entry);
      planEntriesByGoal.set(entry.goal_id, list);
    }
  }

  if (goals) {
    for (const goal of goals) {
      // Skip if not included in plan
      if (!goal.include_in_plan) continue;

      const customEntries = planEntriesByGoal.get(goal.id);
      if (customEntries && customEntries.length > 0) {
        for (const entry of customEntries) {
          // Skip if no valid amount
          if (!entry.amount_cents || entry.amount_cents <= 0) continue;
          
          const entryDate = new Date(entry.entry_month + 'T12:00:00');
          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

          if (realizedGoals?.get(goal.id)?.has(monthKey)) {
            continue;
          }

          const category = goal.category as any;
          projections.push({
            id: `goal-${goal.id}-${monthKey}`,
            type: 'goal_contribution',
            date: entry.entry_month,
            description: entry.description || `Plano personalizado - ${goal.name}`,
            amount_cents: -Math.abs(entry.amount_cents),
            category_id: entry.category_id || goal.category_id || undefined,
            category_name: category?.name || goal.name,
            source_type: 'goal',
            source_id: goal.id,
            metadata: {
              goal_id: goal.id,
              goal_name: goal.name,
              frequency: 'custom',
            },
          });
        }
        continue;
      }

      if (!goal.contribution_frequency) continue;

      const frequency = goal.contribution_frequency as ContributionFrequency;
      const goalStartDate = goal.start_date ? new Date(goal.start_date + 'T12:00:00') : new Date();
      const targetDate = goal.target_date ? new Date(goal.target_date + 'T12:00:00') : null;
      const finalDate = targetDate && targetDate < endDate ? targetDate : endDate;

      // Calculate monthly contribution from frequency if not set
      let monthlyCents = goal.monthly_contribution_cents || 0;
      if (!monthlyCents && goal.contribution_frequency) {
        // If monthly_contribution_cents is not set, we need a base amount
        // For now, we'll need to calculate from target and remaining time
        // This is a simplified calculation - in practice, this should be set when creating the goal
        const monthsRemaining = targetDate
          ? Math.max(1, Math.ceil((targetDate.getTime() - goalStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
          : 12;
        const remainingToGoal = goal.target_amount_cents - goal.current_amount_cents;
        monthlyCents = Math.ceil(remainingToGoal / monthsRemaining);
      }

      if (monthlyCents <= 0) continue;

      // Generate projections for each month in range
      let current = new Date(startDate);
      current.setDate(1); // Start of month

      while (current <= finalDate) {
        // Check if this month should be included based on frequency
        if (!shouldIncludeInMonth(frequency, goalStartDate, current)) {
          current.setMonth(current.getMonth() + 1);
          continue;
        }

        // Check if already realized/paid
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        if (realizedGoals?.get(goal.id)?.has(monthKey)) {
          // Skip if already contributed this month
          current.setMonth(current.getMonth() + 1);
          continue;
        }

        const remainingToGoal = goal.target_amount_cents - goal.current_amount_cents;
        if (remainingToGoal <= 0) break;

        const category = goal.category as any;
        const contributionAmount = Math.min(monthlyCents, remainingToGoal);

        projections.push({
          id: `goal-${goal.id}-${current.getFullYear()}-${current.getMonth() + 1}`,
          type: 'goal_contribution',
          date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(goal.contribution_day || 1).padStart(2, '0')}`,
          description: `Aporte ${getFrequencyLabel(frequency)} - ${goal.name}`,
          amount_cents: -contributionAmount,
          category_id: goal.category_id || undefined,
          category_name: category?.name || goal.name,
          source_type: 'goal',
          source_id: goal.id,
          metadata: {
            goal_id: goal.id,
            goal_name: goal.name,
            goal_icon: goal.icon,
            goal_color: goal.color,
            target_amount: goal.target_amount_cents,
            current_amount: goal.current_amount_cents,
            frequency: frequency,
          },
        });

        // Update current amount for next iteration
        goal.current_amount_cents += contributionAmount;
        current.setMonth(current.getMonth() + 1);
      }
    }
  }

  return projections;
}

/**
 * Get debt payment projections
 */
async function getDebtProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  realizedDebts?: Map<string, Set<string>>
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: debts, error } = await supabase
    .from('debts')
    .select(`
      id,
      name,
      description,
      total_amount_cents,
      paid_amount_cents,
      start_date,
      monthly_payment_cents,
      contribution_frequency,
      installment_amount_cents,
      installment_count,
      current_installment,
      installment_day,
      include_in_plan,
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('is_negotiated', true)
    .eq('status', 'negociada');

  if (error) throw error;

  const { data: planEntries } = await supabase
    .from('debt_plan_entries')
    .select('debt_id, entry_month, amount_cents, description, category_id')
    .eq('user_id', userId)
    .gte('entry_month', startDateStr)
    .lte('entry_month', endDateStr);

  const planEntriesByDebt = new Map<string, typeof planEntries>();
  if (planEntries) {
    for (const entry of planEntries) {
      const list = planEntriesByDebt.get(entry.debt_id) || [];
      list.push(entry);
      planEntriesByDebt.set(entry.debt_id, list);
    }
  }

  if (debts) {
    for (const debt of debts) {
      if (!debt.include_in_plan) continue;
      // Only include debts marked for plan inclusion
      const remainingAmount = debt.total_amount_cents - (debt.paid_amount_cents || 0);
      if (remainingAmount <= 0) continue;

      const debtStartDate = debt.start_date ? new Date(debt.start_date + 'T12:00:00') : new Date();

      const customEntries = planEntriesByDebt.get(debt.id);
      if (customEntries && customEntries.length > 0) {
        for (const entry of customEntries) {
          // Skip if no valid amount
          if (!entry.amount_cents || entry.amount_cents <= 0) continue;
          
          const entryDate = new Date(entry.entry_month + 'T12:00:00');
          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

          if (realizedDebts?.get(debt.id)?.has(monthKey)) {
            continue;
          }

          const category = debt.category as any;
          projections.push({
            id: `debt-${debt.id}-${monthKey}`,
            type: 'debt_payment',
            date: entry.entry_month,
            description: entry.description || `Plano personalizado - ${debt.name}`,
            amount_cents: -Math.abs(entry.amount_cents),
            category_id: entry.category_id || debt.category_id || undefined,
            category_name: category?.name || 'DÍVIDAS',
            source_type: 'debt',
            source_id: debt.id,
            metadata: {
              debt_id: debt.id,
              debt_name: debt.name,
              frequency: 'custom',
            },
          });
        }
        continue;
      }

      // Use new frequency-based system if available
      if (debt.contribution_frequency && debt.monthly_payment_cents) {
        const frequency = debt.contribution_frequency as ContributionFrequency;
        let current = new Date(startDate);
        current.setDate(1); // Start of month

        while (current <= endDate) {
          // Check if this month should be included
          if (!shouldIncludeInMonth(frequency, debtStartDate, current)) {
            current.setMonth(current.getMonth() + 1);
            continue;
          }

          // Check if already realized/paid
          const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          if (realizedDebts?.get(debt.id)?.has(monthKey)) {
            // Skip if already paid this month
            current.setMonth(current.getMonth() + 1);
            continue;
          }

          const remaining = debt.total_amount_cents - (debt.paid_amount_cents || 0);
          if (remaining <= 0) break;

          const category = debt.category as any;
          const paymentAmount = Math.min(debt.monthly_payment_cents, remaining);
          
          // Skip if no valid payment amount
          if (paymentAmount <= 0) {
            current.setMonth(current.getMonth() + 1);
            continue;
          }

          projections.push({
            id: `debt-${debt.id}-${current.getFullYear()}-${current.getMonth() + 1}`,
            type: 'debt_payment',
            date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(debt.installment_day || 1).padStart(2, '0')}`,
            description: `Pagamento ${getFrequencyLabel(frequency)} - ${debt.name}`,
            amount_cents: -paymentAmount,
            category_id: debt.category_id || undefined,
            category_name: category?.name || 'DÍVIDAS',
            source_type: 'debt',
            source_id: debt.id,
            metadata: {
              debt_id: debt.id,
              debt_name: debt.name,
              frequency: frequency,
              total_remaining: remaining,
            },
          });

          current.setMonth(current.getMonth() + 1);
        }
      }
      // Fallback to old installment system
      else if (debt.installment_amount_cents && debt.installment_amount_cents > 0 && debt.installment_count && debt.installment_day) {
        const currentInstallment = debt.current_installment || 1;
        const remainingInstallments = debt.installment_count - currentInstallment + 1;
        const today = new Date();

        for (let i = 0; i < remainingInstallments; i++) {
          const installmentDate = new Date(today.getFullYear(), today.getMonth() + i, debt.installment_day);
          if (installmentDate > endDate) break;
          if (installmentDate < startDate) continue;

          const category = debt.category as any;

          projections.push({
            id: `debt-${debt.id}-inst-${currentInstallment + i}`,
            type: 'debt_payment',
            date: installmentDate.toISOString().split('T')[0],
            description: `${debt.name} (${currentInstallment + i}/${debt.installment_count})`,
            amount_cents: -debt.installment_amount_cents,
            category_id: debt.category_id || undefined,
            category_name: category?.name || 'DÍVIDAS',
            source_type: 'debt',
            source_id: debt.id,
            metadata: {
              debt_id: debt.id,
              debt_name: debt.name,
              installment_number: currentInstallment + i,
              installment_total: debt.installment_count,
              total_remaining: remainingAmount,
            },
          });
        }
      }
    }
  }

  return projections;
}

/**
 * Get installment transaction projections
 */
async function getInstallmentProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: installments, error } = await supabase
    .from('transactions')
    .select(`
      id,
      description,
      amount_cents,
      posted_at,
      installment_number,
      installment_total,
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .not('installment_parent_id', 'is', null)
    .gte('posted_at', startDateStr)
    .lte('posted_at', endDateStr);

  if (error) throw error;

  if (installments) {
    for (const inst of installments) {
      const category = inst.category as any;

      projections.push({
        id: `installment-${inst.id}`,
        type: 'installment',
        date: inst.posted_at,
        description: inst.description,
        amount_cents: inst.amount_cents,
        category_id: inst.category_id || undefined,
        category_name: category?.name || undefined,
        source_type: 'installment',
        source_id: inst.id,
        metadata: {
          transaction_id: inst.id,
          installment_number: inst.installment_number,
          installment_total: inst.installment_total,
          category_icon: category?.icon,
          category_color: category?.color,
        },
      });
    }
  }

  return projections;
}

/**
 * Get investment contribution projections
 */
async function getInvestmentProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  realizedInvestments?: Map<string, Set<string>>
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data: investments, error } = await supabase
    .from('investments')
    .select(`
      id,
      name,
      type,
      institution,
      purchase_date,
      monthly_contribution_cents,
      contribution_frequency,
      include_in_plan,
      category_id,
      category:categories(id, name, icon, color),
      status
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('include_in_plan', true);

  if (error) throw error;

  const { data: planEntries } = await supabase
    .from('investment_plan_entries')
    .select('investment_id, entry_month, amount_cents, description, category_id')
    .eq('user_id', userId)
    .gte('entry_month', startDateStr)
    .lte('entry_month', endDateStr);

  const planEntriesByInvestment = new Map<string, typeof planEntries>();
  if (planEntries) {
    for (const entry of planEntries) {
      const list = planEntriesByInvestment.get(entry.investment_id) || [];
      list.push(entry);
      planEntriesByInvestment.set(entry.investment_id, list);
    }
  }

  if (investments) {
    for (const inv of investments) {
      const customEntries = planEntriesByInvestment.get(inv.id);
      if (customEntries && customEntries.length > 0) {
        for (const entry of customEntries) {
          // Skip if no valid amount
          if (!entry.amount_cents || entry.amount_cents <= 0) continue;
          
          const entryDate = new Date(entry.entry_month + 'T12:00:00');
          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

          if (realizedInvestments?.get(inv.id)?.has(monthKey)) {
            continue;
          }

          const category = inv.category as any;
          projections.push({
            id: `investment-${inv.id}-${monthKey}`,
            type: 'investment_contribution',
            date: entry.entry_month,
            description: entry.description || `Plano personalizado - ${inv.name}`,
            amount_cents: -Math.abs(entry.amount_cents),
            category_id: entry.category_id || inv.category_id || undefined,
            category_name: category?.name || `INVESTIMENTO - ${inv.name.toUpperCase()}`,
            source_type: 'investment',
            source_id: inv.id,
            metadata: {
              investment_id: inv.id,
              investment_name: inv.name,
              investment_type: inv.type,
              institution: inv.institution,
              frequency: 'custom',
            },
          });
        }
        continue;
      }

      if (!inv.contribution_frequency) continue;

      const frequency = inv.contribution_frequency as ContributionFrequency;
      const purchaseDate = new Date(inv.purchase_date + 'T12:00:00');

      // Calculate monthly contribution from frequency if not set
      let monthlyCents = inv.monthly_contribution_cents || 0;
      if (!monthlyCents && inv.contribution_frequency) {
        // This should be set when creating the investment
        // For now, we'll skip if not set
        continue;
      }

      if (monthlyCents <= 0) continue;

      // Generate projections for each month in range
      let current = new Date(startDate);
      current.setDate(1); // Start of month

      while (current <= endDate) {
        // Check if this month should be included based on frequency
        if (!shouldIncludeInMonth(frequency, purchaseDate, current)) {
          current.setMonth(current.getMonth() + 1);
          continue;
        }

        // Check if already realized/paid
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        if (realizedInvestments?.get(inv.id)?.has(monthKey)) {
          // Skip if already contributed this month
          current.setMonth(current.getMonth() + 1);
          continue;
        }

        const category = inv.category as any;

        projections.push({
          id: `investment-${inv.id}-${current.getFullYear()}-${current.getMonth() + 1}`,
          type: 'investment_contribution',
          date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`,
          description: `Aporte ${getFrequencyLabel(frequency)} - ${inv.name}`,
          amount_cents: -monthlyCents,
          category_id: inv.category_id || undefined,
          category_name: category?.name || `INVESTIMENTO - ${inv.name.toUpperCase()}`,
          source_type: 'investment',
          source_id: inv.id,
          metadata: {
            investment_id: inv.id,
            investment_name: inv.name,
            investment_type: inv.type,
            institution: inv.institution,
            frequency: frequency,
          },
        });

        current.setMonth(current.getMonth() + 1);
      }
    }
  }

  return projections;
}

/**
 * Calculate projected daily balances for accounts based on existing projections
 */
async function calculateProjectedAccountBalances(
  supabase: SupabaseClient,
  userId: string,
  monthStart: Date,
  monthEnd: Date,
  existingProjections: ProjectionItem[]
): Promise<Map<string, number>> {
  // Get all accounts with current balances
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, current_balance')
    .eq('user_id', userId)
    .neq('type', 'credit_card');

  const balances = new Map<string, number>();
  if (!accounts) return balances;

  // Initialize balances with current balance
  for (const account of accounts) {
    balances.set(account.id, Math.round((account.current_balance || 0) * 100));
  }

  // Get all transactions up to month start
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const { data: historicalTransactions } = await supabase
    .from('transactions')
    .select('account_id, amount, posted_at')
    .eq('user_id', userId)
    .lt('posted_at', monthStartStr);

  // Apply historical transactions
  if (historicalTransactions) {
    for (const tx of historicalTransactions) {
      const accountId = tx.account_id;
      const amountCents = Math.round((tx.amount || 0) * 100);
      const currentBalance = balances.get(accountId) || 0;
      balances.set(accountId, currentBalance + amountCents);
    }
  }

  // Apply projections that affect account balances (goals, debts, investments, installments)
  // Filter projections that are expenses/income affecting accounts
  const accountAffectingProjections = existingProjections.filter(p => {
    return ['goal_contribution', 'debt_payment', 'investment_contribution', 'installment'].includes(p.type);
  });

  // Group by month and apply sequentially
  const projectionsByMonth = new Map<string, ProjectionItem[]>();
  for (const proj of accountAffectingProjections) {
    const projDate = new Date(proj.date + 'T12:00:00');
    if (projDate >= monthStart && projDate <= monthEnd) {
      const monthKey = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`;
      if (!projectionsByMonth.has(monthKey)) {
        projectionsByMonth.set(monthKey, []);
      }
      projectionsByMonth.get(monthKey)!.push(proj);
    }
  }

  // Apply projections month by month
  const sortedMonths = Array.from(projectionsByMonth.keys()).sort();
  for (const monthKey of sortedMonths) {
    const monthProjections = projectionsByMonth.get(monthKey)!;
    // For simplicity, assume all transactions happen at start of month
    // In a more accurate implementation, we'd need to track daily balances
    for (const proj of monthProjections) {
      // Extract account_id from metadata if available
      // For now, we'll need to get account from the projection source
      // This is a simplified version - in production, we'd need more context
    }
  }

  return balances;
}

/**
 * Get overdraft interest projections based on projected account balances
 */
async function getOverdraftInterestProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  existingProjections: ProjectionItem[]
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];

  // Get accounts with overdraft limit and interest rate
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, overdraft_limit_cents, overdraft_interest_rate_monthly')
    .eq('user_id', userId)
    .neq('type', 'credit_card')
    .gt('overdraft_limit_cents', 0)
    .gt('overdraft_interest_rate_monthly', 0);

  if (!accounts || accounts.length === 0) return projections;

  // Calculate daily rate
  const calculateDailyRate = (monthlyRate: number): number => {
    if (monthlyRate <= 0) return 0;
    const monthlyDecimal = monthlyRate / 100;
    return Math.pow(1 + monthlyDecimal, 1 / 30) - 1;
  };

  // Process month by month
  let current = new Date(startDate);
  current.setDate(1);

  while (current <= endDate) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    
    // Calculate projected balance for each account at end of month
    // Simplified: use current balance + sum of projections affecting this account
    // In production, would need more sophisticated balance tracking
    
    for (const account of accounts) {
      // Get current balance
      const { data: accountData } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', account.id)
        .single();

      if (!accountData) continue;

      let projectedBalanceCents = Math.round((accountData.current_balance || 0) * 100);

      // Add projections that affect this account (simplified - would need account_id in projections)
      // For now, we'll check if any projections might affect this account
      // This is a placeholder - real implementation would track account balances properly

      // If projected balance is negative, generate interest for next month
      if (projectedBalanceCents < 0) {
        const nextMonth = new Date(monthStart);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        if (nextMonth <= endDate) {
          // Calculate interest for the month
          const dailyRate = calculateDailyRate(account.overdraft_interest_rate_monthly || 0);
          const effectiveBalance = Math.max(
            projectedBalanceCents,
            -(account.overdraft_limit_cents || 0)
          );
          
          // Simplified: assume average negative balance for the month
          const daysInMonth = monthEnd.getDate();
          const monthlyInterest = Math.round(effectiveBalance * dailyRate * daysInMonth);

          if (monthlyInterest < 0) {
            // Get or create category
            const { data: category } = await supabase
              .from('categories')
              .select('id, name')
              .eq('user_id', userId)
              .eq('name', 'Juros - Limite')
              .eq('type', 'expense')
              .single();

            if (category) {
              projections.push({
                id: `overdraft-${account.id}-${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`,
                type: 'overdraft_interest',
                date: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`,
                description: `Juros Cheque Especial - ${account.name}`,
                amount_cents: monthlyInterest,
                category_id: category.id,
                category_name: category.name,
                source_type: 'overdraft',
                source_id: account.id,
                metadata: {
                  account_id: account.id,
                  account_name: account.name,
                },
              });
            }
          }
        }
      }
    }

    current.setMonth(current.getMonth() + 1);
  }

  return projections;
}

/**
 * Get account yield projections based on projected account balances
 */
async function getAccountYieldProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date,
  existingProjections: ProjectionItem[]
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];

  // Get accounts with yield rate
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, yield_rate_monthly')
    .eq('user_id', userId)
    .neq('type', 'credit_card')
    .gt('yield_rate_monthly', 0);

  if (!accounts || accounts.length === 0) return projections;

  // Calculate daily rate
  const calculateDailyRate = (monthlyRate: number): number => {
    if (monthlyRate <= 0) return 0;
    const monthlyDecimal = monthlyRate / 100;
    return Math.pow(1 + monthlyDecimal, 1 / 30) - 1;
  };

  // Process month by month
  let current = new Date(startDate);
  current.setDate(1);

  while (current <= endDate) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    
    for (const account of accounts) {
      // Get current balance
      const { data: accountData } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', account.id)
        .single();

      if (!accountData) continue;

      let projectedBalanceCents = Math.round((accountData.current_balance || 0) * 100);

      // If projected balance is positive, generate yield for next month
      if (projectedBalanceCents > 0) {
        const nextMonth = new Date(monthStart);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        if (nextMonth <= endDate) {
          // Calculate yield for the month
          const dailyRate = calculateDailyRate(account.yield_rate_monthly || 0);
          const daysInMonth = monthEnd.getDate();
          const monthlyYield = Math.round(projectedBalanceCents * dailyRate * daysInMonth);

          if (monthlyYield > 0) {
            // Get or create category
            const { data: category } = await supabase
              .from('categories')
              .select('id, name')
              .eq('user_id', userId)
              .eq('name', 'Rendimento - Conta')
              .eq('type', 'income')
              .single();

            if (category) {
              projections.push({
                id: `yield-${account.id}-${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`,
                type: 'account_yield',
                date: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`,
                description: `Rendimento - ${account.name}`,
                amount_cents: monthlyYield,
                category_id: category.id,
                category_name: category.name,
                source_type: 'yield',
                source_id: account.id,
                metadata: {
                  account_id: account.id,
                  account_name: account.name,
                },
              });
            }
          }
        }
      }
    }

    current.setMonth(current.getMonth() + 1);
  }

  return projections;
}

/**
 * Group projections by month and calculate totals
 */
function groupByMonth(projections: ProjectionItem[]): Record<string, { income: number; expenses: number }> {
  const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

  for (const projection of projections) {
    const date = new Date(projection.date + 'T12:00:00');
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyTotals[monthKey]) {
      monthlyTotals[monthKey] = { income: 0, expenses: 0 };
    }

    if (projection.amount_cents > 0) {
      monthlyTotals[monthKey].income += projection.amount_cents;
    } else {
      monthlyTotals[monthKey].expenses += Math.abs(projection.amount_cents);
    }
  }

  return monthlyTotals;
}

