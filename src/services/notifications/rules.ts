import { createClient } from '@/lib/supabase/server';
import {
  shouldSendNotification,
  createNotification,
  updateNotificationSentLog,
  formatCurrency,
  daysUntil,
} from './helper';

export interface NotificationRule {
  id: string;
  user_id: string | null;
  rule_type: 'debt_due' | 'receivable_due' | 'budget_limit' | 'budget_empty' | 'balance_divergence' | 'daily_spending_exceeded' | 'expenses_above_budget';
  enabled: boolean;
  threshold_days?: number | null;
  threshold_percentage?: number | null;
  frequency_hours: number;
}

/**
 * Check debt due notifications
 */
export async function checkDebtDueNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'debt_due' && r.enabled);

  if (!rule) return 0;

  const thresholdDays = rule.threshold_days ?? 7;
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + thresholdDays);

  const { data: debts, error } = await supabase
    .from('debts')
    .select('id, name, due_date, remaining_amount_cents, status')
    .eq('user_id', userId)
    .in('status', ['pendente', 'negociada'])
    .not('due_date', 'is', null)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', futureDate.toISOString().split('T')[0])
    .gt('remaining_amount_cents', 0);

  if (error) {
    console.error('Error checking debt due notifications:', error);
    return 0;
  }

  let count = 0;

  for (const debt of debts || []) {
    if (!debt.due_date) continue;

    const daysUntilDue = daysUntil(debt.due_date);
    const shouldSend = await shouldSendNotification(
      userId,
      'debt_due',
      debt.id,
      rule.frequency_hours
    );

    if (shouldSend) {
      const remaining = formatCurrency(debt.remaining_amount_cents);
      const notificationId = await createNotification(userId, {
        title: 'Vencimento de Dívida Próximo',
        message: `Dívida "${debt.name}" vence em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}. Valor restante: ${remaining}`,
        type: 'warning',
        link: `/app/debts/${debt.id}`,
        metadata: {
          entity_type: 'debts',
          entity_id: debt.id,
          rule_type: 'debt_due',
        },
      });

      if (notificationId) {
        await updateNotificationSentLog(userId, 'debt_due', debt.id, 'debts');
        count++;
      }
    }
  }

  return count;
}

/**
 * Check receivable due notifications
 */
export async function checkReceivableDueNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'receivable_due' && r.enabled);

  if (!rule) return 0;

  const thresholdDays = rule.threshold_days ?? 7;
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + thresholdDays);

  const { data: receivables, error } = await supabase
    .from('receivables')
    .select('id, name, due_date, remaining_amount_cents, status')
    .eq('user_id', userId)
    .in('status', ['pendente', 'negociada'])
    .not('due_date', 'is', null)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', futureDate.toISOString().split('T')[0])
    .gt('remaining_amount_cents', 0);

  if (error) {
    console.error('Error checking receivable due notifications:', error);
    return 0;
  }

  let count = 0;

  for (const receivable of receivables || []) {
    if (!receivable.due_date) continue;

    const daysUntilDue = daysUntil(receivable.due_date);
    const shouldSend = await shouldSendNotification(
      userId,
      'receivable_due',
      receivable.id,
      rule.frequency_hours
    );

    if (shouldSend) {
      const remaining = formatCurrency(receivable.remaining_amount_cents);
      const notificationId = await createNotification(userId, {
        title: 'Vencimento de Recebível Próximo',
        message: `Recebível "${receivable.name}" vence em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}. Valor a receber: ${remaining}`,
        type: 'info',
        link: `/app/receivables/${receivable.id}`,
        metadata: {
          entity_type: 'receivables',
          entity_id: receivable.id,
          rule_type: 'receivable_due',
        },
      });

      if (notificationId) {
        await updateNotificationSentLog(
          userId,
          'receivable_due',
          receivable.id,
          'receivables'
        );
        count++;
      }
    }
  }

  return count;
}

/**
 * Check budget limit notifications
 */
export async function checkBudgetLimitNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'budget_limit' && r.enabled);

  if (!rule) return 0;

  const thresholdPercentage = rule.threshold_percentage ?? 80;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Get budgets for current and future months
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select(`
      id,
      category_id,
      year,
      month,
      amount_planned,
      amount_actual,
      categories(name)
    `)
    .eq('user_id', userId)
    .gt('amount_planned', 0)
    .or(`year.gt.${currentYear},and(year.eq.${currentYear},month.gte.${currentMonth})`);

  if (error) {
    console.error('Error checking budget limit notifications:', error);
    return 0;
  }

  let count = 0;

  for (const budget of budgets || []) {
    const limitCents = Math.round((budget.amount_planned || 0) * 100);
    const actualCents = Math.round((budget.amount_actual || 0) * 100);

    if (limitCents === 0) continue;

    const percentage = (actualCents / limitCents) * 100;

    if (percentage >= thresholdPercentage) {
      const shouldSend = await shouldSendNotification(
        userId,
        'budget_limit',
        budget.id,
        rule.frequency_hours
      );

      if (shouldSend) {
        const categoryName = (budget.categories as any)?.name || 'Categoria';
        const actual = formatCurrency(actualCents);
        const limit = formatCurrency(limitCents);

        const notificationId = await createNotification(userId, {
          title: 'Orçamento Próximo do Limite',
          message: `Orçamento "${categoryName}" está em ${Math.round(percentage)}% do limite (${actual} de ${limit})`,
          type: percentage >= 100 ? 'error' : 'warning',
          link: `/app/budgets?month=${budget.year}-${String(budget.month).padStart(2, '0')}`,
          metadata: {
            entity_type: 'budgets',
            entity_id: budget.id,
            rule_type: 'budget_limit',
          },
        });

        if (notificationId) {
          await updateNotificationSentLog(userId, 'budget_limit', budget.id, 'budgets');
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Check budget empty notifications
 */
export async function checkBudgetEmptyNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'budget_empty' && r.enabled);

  if (!rule) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Get active expense categories
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_active', true);

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError);
    return 0;
  }

  if (!categories || categories.length === 0) return 0;

  // Get budgets for current month
  const { data: budgets, error: budgetsError } = await supabase
    .from('budgets')
    .select('category_id, amount_planned')
    .eq('user_id', userId)
    .eq('year', currentYear)
    .eq('month', currentMonth);

  if (budgetsError) {
    console.error('Error fetching budgets:', budgetsError);
    return 0;
  }

  const budgetedCategoryIds = new Set(
    (budgets || [])
      .filter((b) => (b.amount_planned || 0) > 0)
      .map((b) => b.category_id)
  );

  const emptyCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id));

  if (emptyCategories.length === 0) return 0;

  // Check if we should send notification (only once per month)
  const shouldSend = await shouldSendNotification(
    userId,
    'budget_empty',
    null,
    rule.frequency_hours
  );

  if (!shouldSend) return 0;

  const categoryNames = emptyCategories.map((c) => c.name).join(', ');
  const count = emptyCategories.length;

  const notificationId = await createNotification(userId, {
    title: 'Orçamentos Não Preenchidos',
    message: `Você ainda não definiu um orçamento para ${count} ${count === 1 ? 'categoria' : 'categorias'} neste mês: ${categoryNames}`,
    type: 'info',
    link: '/app/budgets',
    metadata: {
      entity_type: 'budgets',
      rule_type: 'budget_empty',
    },
  });

  if (notificationId) {
    await updateNotificationSentLog(userId, 'budget_empty', null, 'budgets');
    return 1;
  }

  return 0;
}

/**
 * Get notification rules for a user (global + user-specific)
 */
export async function getUserNotificationRules(userId: string): Promise<NotificationRule[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notification_rules')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .eq('enabled', true)
    .order('user_id', { ascending: false }); // User-specific rules first

  if (error) {
    console.error('Error fetching notification rules:', error);
    return [];
  }

  // Deduplicate: if user has specific rule, use it; otherwise use global
  const rulesMap = new Map<string, NotificationRule>();

  for (const rule of data || []) {
    if (!rulesMap.has(rule.rule_type)) {
      rulesMap.set(rule.rule_type, rule);
    } else {
      // Prefer user-specific over global
      if (rule.user_id === userId) {
        rulesMap.set(rule.rule_type, rule);
      }
    }
  }

  return Array.from(rulesMap.values());
}

/**
 * Check balance divergence notifications
 */
export async function checkBalanceDivergenceNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'balance_divergence' && r.enabled);

  if (!rule) return 0;

  // Get all account links for this user with Pluggy accounts
  const { data: links, error } = await supabase
    .from('account_links')
    .select(`
      id,
      pluggy_account_id,
      internal_account_id,
      pluggy_accounts!inner (
        id,
        name,
        balance_cents,
        currency
      ),
      accounts!inner (
        id,
        name,
        current_balance,
        currency
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error checking balance divergence notifications:', error);
    return 0;
  }

  if (!links || links.length === 0) return 0;

  let count = 0;

  for (const link of links) {
    const pluggyAccount = (link as any).pluggy_accounts;
    const internalAccount = (link as any).accounts;

    if (!pluggyAccount || !internalAccount) continue;

    // Convert internal balance from reais (NUMERIC) to cents
    const internalBalanceCents = Math.round((internalAccount.current_balance || 0) * 100);
    const pluggyBalanceCents = pluggyAccount.balance_cents || 0;
    const divergenceCents = Math.abs(pluggyBalanceCents - internalBalanceCents);

    // Check for any divergence (as per plan: any divergence triggers notification)
    if (divergenceCents > 0) {
      const shouldSend = await shouldSendNotification(
        userId,
        'balance_divergence',
        link.id,
        rule.frequency_hours
      );

      if (shouldSend) {
        const divergence = formatCurrency(divergenceCents);
        const accountName = internalAccount.name || pluggyAccount.name || 'Conta';
        const notificationId = await createNotification(userId, {
          title: 'Divergência de Saldo Detectada',
          message: `A conta "${accountName}" apresenta divergência de ${divergence} entre o saldo real e o Open Finance`,
          type: 'warning',
          link: '/app/integration',
          metadata: {
            entity_type: 'account_links',
            entity_id: link.id,
            rule_type: 'balance_divergence',
            divergence_cents: divergenceCents,
            pluggy_balance_cents: pluggyBalanceCents,
            internal_balance_cents: internalBalanceCents,
          },
        });

        if (notificationId) {
          await updateNotificationSentLog(userId, 'balance_divergence', link.id, 'account_links');
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Check daily spending exceeded notifications
 */
export async function checkDailySpendingNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'daily_spending_exceeded' && r.enabled);

  if (!rule) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Get budgets for current month with categories
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select(`
      id,
      amount_planned,
      amount_actual,
      categories!inner (
        id,
        type
      )
    `)
    .eq('user_id', userId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .gt('amount_planned', 0);

  if (error) {
    console.error('Error checking daily spending notifications:', error);
    return 0;
  }

  if (!budgets || budgets.length === 0) return 0;

  // Filter to only expense categories
  const expenseBudgets = budgets.filter(
    (budget) => (budget.categories as any)?.type === 'expense'
  );

  if (expenseBudgets.length === 0) return 0;

  // Calculate total planned and actual expenses
  let totalPlannedCents = 0;
  let totalActualCents = 0;

  for (const budget of expenseBudgets) {
    totalPlannedCents += Math.round((budget.amount_planned || 0) * 100);
    totalActualCents += Math.round((budget.amount_actual || 0) * 100);
  }

  if (totalPlannedCents === 0) return 0;

  // Calculate days elapsed and remaining
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Days elapsed: from first day to today (inclusive)
  // Use current day of month (1-31)
  const currentDay = today.getDate();
  const daysElapsed = Math.max(1, currentDay);
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1); // Include today

  // Calculate average daily spending
  const averageDailyCents = daysElapsed > 0 ? totalActualCents / daysElapsed : 0;

  // Calculate remaining budget and allowed daily spending
  const remainingBudgetCents = totalPlannedCents - totalActualCents;
  const allowedDailyCents = daysRemaining > 0 ? remainingBudgetCents / daysRemaining : 0;

  // Check if average daily spending exceeds allowed daily spending
  if (averageDailyCents > allowedDailyCents && allowedDailyCents >= 0) {
    const shouldSend = await shouldSendNotification(
      userId,
      'daily_spending_exceeded',
      null,
      rule.frequency_hours
    );

    if (shouldSend) {
      const avgDaily = formatCurrency(Math.round(averageDailyCents));
      const allowedDaily = formatCurrency(Math.round(allowedDailyCents));
      const notificationId = await createNotification(userId, {
        title: 'Gasto Diário Acima do Permitido',
        message: `Sua média de gasto diário (${avgDaily}) está acima do permitido (${allowedDaily}) para o restante do mês`,
        type: 'error',
        link: '/app/budgets',
        metadata: {
          entity_type: 'budgets',
          rule_type: 'daily_spending_exceeded',
          average_daily_cents: Math.round(averageDailyCents),
          allowed_daily_cents: Math.round(allowedDailyCents),
          total_spent_cents: totalActualCents,
          total_budget_cents: totalPlannedCents,
        },
      });

      if (notificationId) {
        await updateNotificationSentLog(userId, 'daily_spending_exceeded', null, 'budgets');
        return 1;
      }
    }
  }

  return 0;
}

/**
 * Check expenses above budget notifications
 * Alerts when actual spending exceeds the planned budget for categories
 */
export async function checkExpensesAboveBudgetNotifications(
  userId: string,
  rules: NotificationRule[]
): Promise<number> {
  const supabase = await createClient();
  const rule = rules.find((r) => r.rule_type === 'expenses_above_budget' && r.enabled);

  if (!rule) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Get budgets for current month with categories that are over budget
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select(`
      id,
      category_id,
      year,
      month,
      amount_planned,
      amount_actual,
      categories!inner (
        id,
        name,
        type
      )
    `)
    .eq('user_id', userId)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .gt('amount_planned', 0);

  if (error) {
    console.error('Error checking expenses above budget notifications:', error);
    return 0;
  }

  if (!budgets || budgets.length === 0) return 0;

  let count = 0;

  for (const budget of budgets) {
    const category = budget.categories as any;
    
    // Only check expense categories
    if (category?.type !== 'expense') continue;

    const plannedCents = Math.round((budget.amount_planned || 0) * 100);
    const actualCents = Math.round((budget.amount_actual || 0) * 100);

    // Check if actual exceeds planned
    if (actualCents > plannedCents && plannedCents > 0) {
      const excessCents = actualCents - plannedCents;
      const excessPercentage = Math.round((excessCents / plannedCents) * 100);

      const shouldSend = await shouldSendNotification(
        userId,
        'expenses_above_budget',
        budget.id,
        rule.frequency_hours
      );

      if (shouldSend) {
        const categoryName = category?.name || 'Categoria';
        const actual = formatCurrency(actualCents);
        const planned = formatCurrency(plannedCents);
        const excess = formatCurrency(excessCents);

        const notificationId = await createNotification(userId, {
          title: 'Despesas Acima do Orçamento',
          message: `A categoria "${categoryName}" ultrapassou o orçamento em ${excess} (${excessPercentage}% acima). Gasto: ${actual} | Orçado: ${planned}. Considere ajustar seu orçamento.`,
          type: 'error',
          link: `/app/budgets?month=${budget.year}-${String(budget.month).padStart(2, '0')}`,
          metadata: {
            entity_type: 'budgets',
            entity_id: budget.id,
            rule_type: 'expenses_above_budget',
            category_id: budget.category_id,
            category_name: categoryName,
            planned_cents: plannedCents,
            actual_cents: actualCents,
            excess_cents: excessCents,
            excess_percentage: excessPercentage,
          },
        });

        if (notificationId) {
          await updateNotificationSentLog(userId, 'expenses_above_budget', budget.id, 'budgets');
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Run all notification checks for a user
 */
export async function checkAllNotifications(userId: string): Promise<{
  debt_due: number;
  receivable_due: number;
  budget_limit: number;
  budget_empty: number;
  balance_divergence: number;
  daily_spending_exceeded: number;
  expenses_above_budget: number;
  total: number;
}> {
  const rules = await getUserNotificationRules(userId);

  const [
    debt_due,
    receivable_due,
    budget_limit,
    budget_empty,
    balance_divergence,
    daily_spending_exceeded,
    expenses_above_budget,
  ] = await Promise.all([
    checkDebtDueNotifications(userId, rules),
    checkReceivableDueNotifications(userId, rules),
    checkBudgetLimitNotifications(userId, rules),
    checkBudgetEmptyNotifications(userId, rules),
    checkBalanceDivergenceNotifications(userId, rules),
    checkDailySpendingNotifications(userId, rules),
    checkExpensesAboveBudgetNotifications(userId, rules),
  ]);

  return {
    debt_due,
    receivable_due,
    budget_limit,
    budget_empty,
    balance_divergence,
    daily_spending_exceeded,
    expenses_above_budget,
    total:
      debt_due +
      receivable_due +
      budget_limit +
      budget_empty +
      balance_divergence +
      daily_spending_exceeded +
      expenses_above_budget,
  };
}
