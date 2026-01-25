import type { PlanFeature, PlanFeatures } from '@/services/admin/globalSettings';

export type PlanModuleId =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'credit_cards'
  | 'categories'
  | 'budgets'
  | 'debts'
  | 'receivables'
  | 'investments'
  | 'assets'
  | 'goals'
  | 'reports'
  | 'integrations'
  | 'ai_advisor';

/**
 * Check if Open Finance is available for non-admin users
 * Currently, Open Finance is restricted to admins only
 * When this restriction is removed, update this function to check pluggy_enabled
 */
async function isOpenFinanceAvailableForNonAdmin(): Promise<boolean> {
  try {
    const { getGlobalSettings } = await import('@/services/admin/globalSettings');
    const settings = await getGlobalSettings();
    // For now, Open Finance is admin-only, so return false
    // When restriction is removed, return: settings.pluggy_enabled || false
    return false;
  } catch {
    return false;
  }
}

export const PLAN_MODULES: Array<{ id: PlanModuleId; label: string; route: string }> = [
  { id: 'dashboard', label: 'Dashboard', route: '/app' },
  { id: 'transactions', label: 'Transações', route: '/app/transactions' },
  { id: 'accounts', label: 'Contas', route: '/app/accounts' },
  { id: 'credit_cards', label: 'Cartões', route: '/app/credit-cards' },
  { id: 'categories', label: 'Categorias', route: '/app/categories' },
  { id: 'budgets', label: 'Orçamentos', route: '/app/budgets' },
  { id: 'debts', label: 'Dívidas', route: '/app/debts' },
  { id: 'receivables', label: 'Recebíveis', route: '/app/receivables' },
  { id: 'investments', label: 'Investimentos', route: '/app/investments' },
  { id: 'assets', label: 'Patrimônio', route: '/app/assets' },
  { id: 'goals', label: 'Objetivos', route: '/app/goals' },
  { id: 'reports', label: 'Relatórios', route: '/app/reports' },
  { id: 'integrations', label: 'Integrações (Whatsapp + OpenFinance*)', route: '/app/integrations' },
  { id: 'ai_advisor', label: 'AI Advisor (chat)', route: '/app/advisor' },
];

const MODULE_LABELS = PLAN_MODULES.reduce<Record<string, string>>((acc, planModule) => {
  acc[planModule.id] = planModule.label;
  return acc;
}, {});

/**
 * Synchronous version for client components
 * Currently always returns with asterisk since Open Finance is admin-only
 * When Open Finance is available for non-admin, this will need to be updated
 */
// Descriptive labels for features in pricing display
const DESCRIPTIVE_LABELS: Record<string, string> = {
  dashboard: 'Visão geral das finanças',
  accounts: 'Contas bancárias ilimitadas',
  credit_cards: 'Controle de cartões de crédito',
  categories: 'Categorização personalizada',
  budgets: 'Orçamentos mensais por categoria',
  debts: 'Controle e negociação de dívidas',
  receivables: 'Gestão de recebíveis',
  investments: 'Acompanhamento de investimentos',
  assets: 'Gestão de patrimônio e bens',
  goals: 'Metas financeiras com projeções',
  reports: 'Relatórios detalhados e exportação',
};

export function formatFeatureTextSync(featureId: string, feature: PlanFeature | undefined): string {
  if (featureId === 'transactions') {
    if (feature?.unlimited) return 'Lançamentos ilimitados';
    if (typeof feature?.limit === 'number') {
      return `Até ${feature.limit} lançamentos/mês`;
    }
    return 'Lançamentos';
  }

  if (featureId === 'ai_advisor') {
    if (feature?.unlimited) return 'AI Advisor ilimitado';
    if (typeof feature?.limit === 'number') {
      return `AI Advisor (${feature.limit} consultas/mês)`;
    }
    return 'AI Advisor';
  }

  if (featureId === 'integrations') {
    // For now, always return with asterisk since Open Finance is admin-only
    // When Open Finance is available for non-admin, update this logic
    return 'WhatsApp + Open Finance*';
  }

  return DESCRIPTIVE_LABELS[featureId] || MODULE_LABELS[featureId] || featureId;
}

/**
 * Async version for server components
 * Checks if Open Finance is available for non-admin users
 */
export async function formatFeatureText(featureId: string, feature: PlanFeature | undefined): Promise<string> {
  if (featureId === 'transactions') {
    if (feature?.unlimited) return 'Lançamentos ilimitados';
    if (typeof feature?.limit === 'number') {
      return `Até ${feature.limit} lançamentos/mês`;
    }
    return 'Lançamentos';
  }

  if (featureId === 'ai_advisor') {
    if (feature?.unlimited) return 'AI Advisor ilimitado';
    if (typeof feature?.limit === 'number') {
      return `AI Advisor (${feature.limit} consultas/mês)`;
    }
    return 'AI Advisor';
  }

  if (featureId === 'integrations') {
    const openFinanceAvailable = await isOpenFinanceAvailableForNonAdmin();
    if (openFinanceAvailable) {
      return 'WhatsApp + Open Finance';
    }
    return 'WhatsApp + Open Finance*';
  }

  return DESCRIPTIVE_LABELS[featureId] || MODULE_LABELS[featureId] || featureId;
}

function resolveFeatureLimit(feature: PlanFeature | undefined): { enabled: boolean; unlimited: boolean; limit: number } {
  if (!feature?.enabled) {
    return { enabled: false, unlimited: false, limit: 0 };
  }

  if (feature.unlimited) {
    return { enabled: true, unlimited: true, limit: -1 };
  }

  if (typeof feature.limit === 'number') {
    return { enabled: true, unlimited: false, limit: feature.limit };
  }

  return { enabled: true, unlimited: false, limit: 0 };
}

function isLimitUpgrade(current: PlanFeature | undefined, previous: PlanFeature | undefined): boolean {
  const currentResolved = resolveFeatureLimit(current);
  const previousResolved = resolveFeatureLimit(previous);

  if (!previousResolved.enabled && currentResolved.enabled) return true;
  if (!currentResolved.enabled) return false;
  if (currentResolved.unlimited && !previousResolved.unlimited) return true;
  if (!currentResolved.unlimited && previousResolved.unlimited) return false;
  return currentResolved.limit > previousResolved.limit;
}

export function planIncludesAllFeatures(current: PlanFeatures, previous: PlanFeatures): boolean {
  // If previous plan is empty, current includes all by default
  if (!previous || Object.keys(previous).length === 0) return true;
  
  return PLAN_MODULES.every((planModule) => {
    const currentFeature = current?.[planModule.id];
    const previousFeature = previous?.[planModule.id];

    // If previous plan doesn't have this feature enabled, no need to check
    if (!previousFeature?.enabled) return true;
    
    // For transactions and ai_advisor, check limits
    if (planModule.id === 'transactions' || planModule.id === 'ai_advisor') {
      const currentResolved = resolveFeatureLimit(currentFeature);
      const previousResolved = resolveFeatureLimit(previousFeature);

      // If current doesn't have this feature defined, assume it's inherited (not less than previous)
      if (currentFeature === undefined) return true;
      
      if (!currentResolved.enabled) return false;
      if (previousResolved.unlimited) return currentResolved.unlimited;
      if (currentResolved.unlimited) return true;
      return currentResolved.limit >= previousResolved.limit;
    }

    // For other features: if not explicitly set in current, assume inherited
    // Only return false if explicitly disabled (enabled === false)
    if (currentFeature === undefined) return true;
    return currentFeature?.enabled !== false;
  });
}

/**
 * Synchronous version for client components
 */
export function buildPlanFeatureListSync(
  features: PlanFeatures
): Array<{ id: PlanModuleId; text: string; enabled: boolean }> {
  const items: Array<{ id: PlanModuleId; text: string; enabled: boolean }> = [];
  PLAN_MODULES.forEach((planModule) => {
    const feature = features?.[planModule.id];
    if (!feature?.enabled) return;
    items.push({
      id: planModule.id,
      text: formatFeatureTextSync(planModule.id, feature),
      enabled: true,
    });
  });
  return items;
}

/**
 * Async version for server components
 */
export async function buildPlanFeatureList(
  features: PlanFeatures
): Promise<Array<{ id: PlanModuleId; text: string; enabled: boolean }>> {
  const items: Array<{ id: PlanModuleId; text: string; enabled: boolean }> = [];
  for (const planModule of PLAN_MODULES) {
    const feature = features?.[planModule.id];
    if (!feature?.enabled) continue;
    const text = await formatFeatureText(planModule.id, feature);
    items.push({
      id: planModule.id,
      text,
      enabled: true,
    });
  }
  return items;
}

/**
 * Synchronous version for client components
 */
export function buildPlanFeatureListWithInheritanceSync(
  current: PlanFeatures,
  previous: PlanFeatures | null,
  previousLabel: string | null
): Array<{ id: string; text: string; enabled: boolean }> {
  const currentList = buildPlanFeatureListSync(current);
  if (!previous || !previousLabel) {
    return currentList;
  }

  const includesAll = planIncludesAllFeatures(current, previous);
  if (!includesAll) {
    return currentList;
  }

  const additionalItems: Array<{ id: string; text: string; enabled: boolean }> = [];

  PLAN_MODULES.forEach((planModule) => {
    const currentFeature = current?.[planModule.id];
    const previousFeature = previous?.[planModule.id];

    if (!currentFeature?.enabled) return;
    if (!previousFeature?.enabled) {
      additionalItems.push({
        id: planModule.id,
        text: formatFeatureTextSync(planModule.id, currentFeature),
        enabled: true,
      });
      return;
    }

    if (planModule.id === 'transactions' || planModule.id === 'ai_advisor') {
      if (isLimitUpgrade(currentFeature, previousFeature)) {
        additionalItems.push({
          id: planModule.id,
          text: formatFeatureTextSync(planModule.id, currentFeature),
          enabled: true,
        });
      }
    }
  });

  return [
    {
      id: `all_${previousLabel.toLowerCase()}`,
      text: `Tudo do plano ${previousLabel}`,
      enabled: true,
    },
    ...additionalItems,
  ];
}

/**
 * Async version for server components
 */
export async function buildPlanFeatureListWithInheritance(
  current: PlanFeatures,
  previous: PlanFeatures | null,
  previousLabel: string | null
): Promise<Array<{ id: string; text: string; enabled: boolean }>> {
  const currentList = await buildPlanFeatureList(current);
  if (!previous || !previousLabel) {
    return currentList;
  }

  const includesAll = planIncludesAllFeatures(current, previous);
  if (!includesAll) {
    return currentList;
  }

  const additionalItems: Array<{ id: string; text: string; enabled: boolean }> = [];

  for (const planModule of PLAN_MODULES) {
    const currentFeature = current?.[planModule.id];
    const previousFeature = previous?.[planModule.id];

    if (!currentFeature?.enabled) continue;
    if (!previousFeature?.enabled) {
      const text = await formatFeatureText(planModule.id, currentFeature);
      additionalItems.push({
        id: planModule.id,
        text,
        enabled: true,
      });
      continue;
    }

    if (planModule.id === 'transactions' || planModule.id === 'ai_advisor') {
      if (isLimitUpgrade(currentFeature, previousFeature)) {
        const text = await formatFeatureText(planModule.id, currentFeature);
        additionalItems.push({
          id: planModule.id,
          text,
          enabled: true,
        });
      }
    }
  }

  return [
    {
      id: `all_${previousLabel.toLowerCase()}`,
      text: `Tudo do plano ${previousLabel}`,
      enabled: true,
    },
    ...additionalItems,
  ];
}

export function resolvePlanLimit(feature: PlanFeature | undefined, fallback: number): { enabled: boolean; unlimited: boolean; limit: number } {
  if (!feature?.enabled) {
    return { enabled: false, unlimited: false, limit: 0 };
  }

  if (feature.unlimited) {
    return { enabled: true, unlimited: true, limit: -1 };
  }

  if (typeof feature.limit === 'number') {
    return { enabled: true, unlimited: false, limit: feature.limit };
  }

  if (fallback === -1) {
    return { enabled: true, unlimited: true, limit: -1 };
  }

  return { enabled: true, unlimited: false, limit: fallback };
}
