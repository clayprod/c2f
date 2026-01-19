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
  rule_type: 'debt_due' | 'receivable_due' | 'budget_limit' | 'budget_empty';
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
 * Run all notification checks for a user
 */
export async function checkAllNotifications(userId: string): Promise<{
  debt_due: number;
  receivable_due: number;
  budget_limit: number;
  budget_empty: number;
  total: number;
}> {
  const rules = await getUserNotificationRules(userId);

  const [debt_due, receivable_due, budget_limit, budget_empty] = await Promise.all([
    checkDebtDueNotifications(userId, rules),
    checkReceivableDueNotifications(userId, rules),
    checkBudgetLimitNotifications(userId, rules),
    checkBudgetEmptyNotifications(userId, rules),
  ]);

  return {
    debt_due,
    receivable_due,
    budget_limit,
    budget_empty,
    total: debt_due + receivable_due + budget_limit + budget_empty,
  };
}
