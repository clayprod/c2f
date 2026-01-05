import { SupabaseClient } from '@supabase/supabase-js';
import { 
  ContributionFrequency, 
  calculateMonthlyTotal, 
  shouldIncludeInMonth,
  getFrequencyLabel 
} from './frequency';

export interface ProjectionItem {
  id: string;
  type: 'credit_card_bill' | 'recurring_expense' | 'recurring_income' | 'goal_contribution' | 'debt_payment' | 'investment_contribution' | 'installment';
  date: string; // YYYY-MM-DD
  description: string;
  amount_cents: number;
  category_id?: string;
  category_name?: string;
  source_type: 'credit_card' | 'goal' | 'debt' | 'recurring' | 'installment';
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
      const goalProjections = await getGoalProjections(supabase, userId, startDate, endDate);
      projections.push(...goalProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de objetivos: ${error.message}`);
    }

    // 3. Negotiated debts
    try {
      checkTimeout();
      const debtProjections = await getDebtProjections(supabase, userId, startDate, endDate);
      projections.push(...debtProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de dívidas: ${error.message}`);
    }

    // 4. Recurring transactions
    try {
      checkTimeout();
      const recurringProjections = await getRecurringProjections(supabase, userId, startDate, endDate);
      projections.push(...recurringProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de transações recorrentes: ${error.message}`);
    }

    // 5. Installment transactions
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
      const investmentProjections = await getInvestmentProjections(supabase, userId, startDate, endDate);
      projections.push(...investmentProjections);
    } catch (error: any) {
      errors.push(`Erro ao gerar projeções de investimentos: ${error.message}`);
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
  endDate: Date
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];

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
      include_in_projection,
      include_in_budget,
      icon,
      color,
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .or('include_in_projection.eq.true,include_in_budget.eq.true')
    .not('contribution_frequency', 'is', null);

  if (error) throw error;

  if (goals) {
    for (const goal of goals) {
      // Skip if not included in budget or projection
      if (!goal.include_in_projection && !goal.include_in_budget) continue;
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
  endDate: Date
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];

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
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('is_negotiated', true)
    .in('status', ['active', 'overdue', 'negotiating']);

  if (error) throw error;

  if (debts) {
    for (const debt of debts) {
      // Only include if include_in_budget is true (for budget projections)
      // For regular projections, include all negotiated debts
      const remainingAmount = debt.total_amount_cents - (debt.paid_amount_cents || 0);
      if (remainingAmount <= 0) continue;

      const debtStartDate = debt.start_date ? new Date(debt.start_date + 'T12:00:00') : new Date();

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

          const remaining = debt.total_amount_cents - (debt.paid_amount_cents || 0);
          if (remaining <= 0) break;

          const category = debt.category as any;
          const paymentAmount = Math.min(debt.monthly_payment_cents, remaining);

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
      else if (debt.installment_amount_cents && debt.installment_count && debt.installment_day) {
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
 * Get recurring transaction projections
 */
async function getRecurringProjections(
  supabase: SupabaseClient,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];

  const { data: recurringTransactions, error } = await supabase
    .from('transactions')
    .select(`
      id,
      description,
      amount,
      posted_at,
      recurrence_rule,
      contribution_frequency,
      category_id,
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .or('recurrence_rule.not.is.null,contribution_frequency.not.is.null');

  if (error) throw error;

  if (recurringTransactions) {
    for (const tx of recurringTransactions) {
      const amountCents = Math.round(Math.abs(parseFloat(tx.amount?.toString() || '0')) * 100);
      const isIncome = parseFloat(tx.amount?.toString() || '0') > 0;
      const txDate = new Date(tx.posted_at + 'T12:00:00');

      // Use contribution_frequency if available, otherwise parse recurrence_rule
      let frequency: ContributionFrequency = 'monthly';
      let futureDates: string[] = [];

      if (tx.contribution_frequency) {
        frequency = tx.contribution_frequency as ContributionFrequency;
        
        // Generate dates based on frequency
        let current = new Date(startDate);
        current.setDate(1); // Start of month

        while (current <= endDate) {
          if (shouldIncludeInMonth(frequency, txDate, current)) {
            const day = txDate.getDate();
            const monthDate = new Date(current.getFullYear(), current.getMonth(), Math.min(day, 28));
            futureDates.push(monthDate.toISOString().split('T')[0]);
          }
          current.setMonth(current.getMonth() + 1);
        }
      } else if (tx.recurrence_rule) {
        // Fallback to old RRULE parsing
        futureDates = generateFutureDates(
          tx.posted_at,
          tx.recurrence_rule,
          startDate,
          endDate
        );
      }

      const category = tx.category as any;

      for (const futureDate of futureDates) {
        projections.push({
          id: `recurring-${tx.id}-${futureDate}`,
          type: isIncome ? 'recurring_income' : 'recurring_expense',
          date: futureDate,
          description: tx.description,
          amount_cents: isIncome ? amountCents : -amountCents,
          category_id: tx.category_id || undefined,
          category_name: category?.name || undefined,
          source_type: 'recurring',
          source_id: tx.id,
          metadata: {
            transaction_id: tx.id,
            category_icon: category?.icon,
            category_color: category?.color,
            frequency: frequency,
          },
        });
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
  endDate: Date
): Promise<ProjectionItem[]> {
  const projections: ProjectionItem[] = [];

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
      category_id,
      category:categories(id, name, icon, color),
      status
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('include_in_budget', true)
    .not('contribution_frequency', 'is', null);

  if (error) throw error;

  if (investments) {
    for (const inv of investments) {
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

        const category = inv.category as any;

        projections.push({
          id: `investment-${inv.id}-${current.getFullYear()}-${current.getMonth() + 1}`,
          type: 'investment_contribution',
          date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`,
          description: `Aporte ${getFrequencyLabel(frequency)} - ${inv.name}`,
          amount_cents: -monthlyCents,
          category_id: inv.category_id || undefined,
          category_name: category?.name || `INVESTIMENTO - ${inv.name.toUpperCase()}`,
          source_type: 'goal', // Using goal type for now, could add investment type later
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
 * Generate future dates based on recurrence rule
 */
function generateFutureDates(
  startDate: string,
  rrule: string,
  fromDate: Date,
  toDate: Date
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');

  // Parse simple RRULE (FREQ=MONTHLY;INTERVAL=1)
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);

  if (!freqMatch) return dates;

  const freq = freqMatch[1];
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

  let current = new Date(start);

  // Find the first occurrence after fromDate
  while (current < fromDate) {
    switch (freq) {
      case 'DAILY':
        current.setDate(current.getDate() + interval);
        break;
      case 'WEEKLY':
        current.setDate(current.getDate() + (7 * interval));
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + interval);
        break;
      case 'YEARLY':
        current.setFullYear(current.getFullYear() + interval);
        break;
    }
  }

  // Generate dates until toDate
  while (current <= toDate) {
    dates.push(current.toISOString().split('T')[0]);

    switch (freq) {
      case 'DAILY':
        current.setDate(current.getDate() + interval);
        break;
      case 'WEEKLY':
        current.setDate(current.getDate() + (7 * interval));
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + interval);
        break;
      case 'YEARLY':
        current.setFullYear(current.getFullYear() + interval);
        break;
    }
  }

  return dates;
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

