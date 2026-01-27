'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { BudgetsByCategory } from '@/components/dashboard/BudgetsByCategory';
import { AdvisorTips } from '@/components/dashboard/AdvisorTips';
import { Button } from '@/components/ui/button';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { useProfile } from '@/hooks/useProfile';
import { PlanGuard } from '@/components/app/PlanGuard';
import { useAccountContext } from '@/hooks/useAccountContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PlanFeatures } from '@/services/admin/globalSettings';
import { useRealtimeCashflowUpdates } from '@/hooks/useRealtimeCashflowUpdates';
import { formatCurrencyValue } from '@/lib/utils';
import { PremiumUpgradeTooltip } from '@/components/ui/PremiumUpgradeTooltip';

interface DashboardData {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number | string;
  posted_at: string;
  categories?: { name: string };
}

interface MonthlyTotal {
  planned_income: number;
  planned_expenses: number;
  actual_income: number;
  actual_expenses: number;
}

type GroupByType = 'month' | 'quarter' | 'year';

const GROUP_OPTIONS: { label: string; value: GroupByType }[] = [
  { label: 'Mês', value: 'month' },
  { label: 'Trimestre', value: 'quarter' },
  { label: 'Ano', value: 'year' },
];

const PERIOD_OPTIONS_BY_GROUP: Record<GroupByType, { label: string; periods: number }[]> = {
  month: [
    { label: '6 meses', periods: 6 },
    { label: '1 ano', periods: 12 },
    { label: '2 anos', periods: 24 },
    { label: '5 anos', periods: 60 },
  ],
  quarter: [
    { label: '4 trim.', periods: 4 },
    { label: '8 trim.', periods: 8 },
    { label: '12 trim.', periods: 12 },
  ],
  year: [
    { label: '5 anos', periods: 5 },
    { label: '10 anos', periods: 10 },
    { label: '15 anos', periods: 15 },
  ],
};

// Alias para manter compatibilidade com código existente
const formatCurrency = formatCurrencyValue;

// Função para truncar texto do início (mostrar o final)
const truncateStart = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return '...' + text.slice(-(maxLength - 3));
};

// Função para obter o nome do mês atual no timezone do Brasil (UTC-3)
const getCurrentMonthName = () => {
  const now = new Date();
  // Converter para timezone do Brasil (America/Sao_Paulo = UTC-3)
  const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brazilDate.toLocaleDateString('pt-BR', { month: 'long' });
};

// Component to wrap features with lock visual when not available
function LockedFeatureWrapper({
  children,
  featureId,
  minPlan,
  planFeatures,
  userPlan,
}: {
  children: React.ReactNode;
  featureId: string;
  minPlan: 'free' | 'pro' | 'premium';
  planFeatures: PlanFeatures | null;
  userPlan?: 'free' | 'pro' | 'premium';
}) {
  const isAvailable = (() => {
    if (planFeatures) {
      const enabled = planFeatures[featureId]?.enabled;
      if (enabled !== undefined) return enabled;
    }
    if (!userPlan) return minPlan === 'free';
    const planOrder: Record<'free' | 'pro' | 'premium', number> = { free: 0, pro: 1, premium: 2 };
    return planOrder[userPlan] >= planOrder[minPlan];
  })();

  if (isAvailable) {
    return <>{children}</>;
  }

  const planLabel = minPlan === 'pro' ? 'Pro' : 'Premium';

  return (
    <PremiumUpgradeTooltip planLabel={planLabel} isLocked={true} followMouse={true}>
      <div className="relative w-full min-w-0 overflow-hidden">
        <style dangerouslySetInnerHTML={{
          __html: `
          .locked-feature-wrapper > div:first-child {
            opacity: 0.3 !important;
            filter: blur(4px) !important;
          }
          .locked-feature-wrapper h2,
          .locked-feature-wrapper .font-display,
          .locked-feature-wrapper h2 *,
          .locked-feature-wrapper .font-display * {
            opacity: 1 !important;
            filter: blur(0) !important;
            position: relative !important;
            z-index: 30 !important;
          }
        `}} />
        <div className="locked-feature-wrapper w-full min-w-0 overflow-hidden">
          <div className="pointer-events-none w-full min-w-0" style={{ opacity: 0.3, filter: 'blur(4px)' }}>
            {children}
          </div>
          {/* Cadeado centralizado - fica na frente */}
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <i className="bx bx-lock text-4xl text-muted-foreground drop-shadow-lg"></i>
            </div>
          </div>
        </div>
      </div>
    </PremiumUpgradeTooltip>
  );
}

// Updated: 2026-01-18 - Melhorias na indicação do mês corrente
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState<Record<string, MonthlyTotal>>({});
  const [cashFlowLoading, setCashFlowLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByType>('month');
  const [selectedPeriod, setSelectedPeriod] = useState(12); // Default: 1 year (or first option of group)
  const { isFree, loading: profileLoading, userProfile } = useProfile();
  const { context: accountContext, activeAccountId } = useAccountContext();
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const maxVisibleItems = 9; // Número fixo de transações visíveis
  const budgetsContainerRef = useRef<HTMLDivElement>(null);
  const ownerId = activeAccountId || accountContext?.currentUserId || null;

  // Número fixo de itens para evitar cortes - 9 itens no desktop e mobile

  // Altura das transações agora é automática para evitar cortes

  // Memoizar o nome do mês atual para evitar recálculos
  const currentMonthName = useMemo(() => {
    try {
      const monthName = getCurrentMonthName();
      if (!monthName || monthName === 'Invalid Date') {
        // Fallback caso haja problema com timezone
        const now = new Date();
        return now.toLocaleDateString('pt-BR', { month: 'long' }).charAt(0).toUpperCase() +
          now.toLocaleDateString('pt-BR', { month: 'long' }).slice(1);
      }
      return monthName.charAt(0).toUpperCase() + monthName.slice(1);
    } catch (error) {
      // Fallback em caso de erro
      const now = new Date();
      return now.toLocaleDateString('pt-BR', { month: 'long' }).charAt(0).toUpperCase() +
        now.toLocaleDateString('pt-BR', { month: 'long' }).slice(1);
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch accounts for balance
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      const accounts = accountsData.data || [];

      // Fetch recent transactions
      const transactionsRes = await fetch('/api/transactions?limit=50');
      if (!transactionsRes.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const transactionsData = await transactionsRes.json();
      const transactions = transactionsData.data || [];

      // Calculate totals
      const totalBalance = accounts.reduce((sum: number, acc: any) => {
        return sum + (parseFloat(acc.current_balance || acc.balance_cents / 100 || 0) || 0);
      }, 0);

      // Usar timezone do Brasil (UTC-3)
      const now = new Date();
      const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentMonth = brazilDate.getMonth();
      const currentYear = brazilDate.getFullYear();

      const monthTransactions = transactions.filter((tx: Transaction) => {
        const txDate = new Date(tx.posted_at);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });

      const totalIncome = monthTransactions
        .filter((tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          return amount > 0;
        })
        .reduce((sum: number, tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          return sum + amount;
        }, 0);

      const totalExpenses = Math.abs(
        monthTransactions
          .filter((tx: Transaction) => {
            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            return amount < 0;
          })
          .reduce((sum: number, tx: Transaction) => {
            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            return sum + amount;
          }, 0)
      );

      const savings = totalIncome - totalExpenses;

      setData({
        totalBalance,
        totalIncome,
        totalExpenses,
        savings,
      });

      setRecentTransactions(transactions.slice(0, 50));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setData({
        totalBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        savings: 0,
      });
      setRecentTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashFlowData = useCallback(async () => {
    try {
      setCashFlowLoading(true);
      // Usar timezone do Brasil (UTC-3)
      const today = new Date();
      const brazilDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentYear = brazilDate.getFullYear();
      const currentMonth = brazilDate.getMonth();

      // Buscar mais dados baseado no agrupamento
      const monthsBack = groupBy === 'year' ? 180 : (groupBy === 'quarter' ? 48 : 24);
      const monthsForward = groupBy === 'year' ? 180 : (groupBy === 'quarter' ? 48 : 24);

      // Start: monthsBack months back from current
      const startDate = new Date(currentYear, currentMonth - monthsBack, 1);

      // End: monthsForward months forward from current
      const endDate = new Date(currentYear, currentMonth + monthsForward, 1);
      // Set to last day of that month
      endDate.setMonth(endDate.getMonth() + 1, 0);

      const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

      const res = await fetch(
        `/api/budgets?include_projections=true&start_month=${startMonth}&end_month=${endMonth}`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch cash flow data');
      }

      const result = await res.json();
      if (result.data?.monthly_totals) {
        setCashFlowData(result.data.monthly_totals);
      }
    } catch (error) {
      console.error('Error fetching cash flow data:', error);
    } finally {
      setCashFlowLoading(false);
    }
  }, [groupBy]);

  useEffect(() => {
    fetchDashboardData();
    fetchPlanFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPlanFeatures = async () => {
    try {
      const res = await fetch('/api/billing/plan');
      if (res.ok) {
        const data = await res.json();
        setPlanFeatures(data.features || null);
      }
    } catch (error) {
      console.error('Error fetching plan features:', error);
    }
  };

  useEffect(() => {
    fetchCashFlowData();
  }, [fetchCashFlowData]);

  // Reset selectedPeriod when groupBy changes
  useEffect(() => {
    const firstOption = PERIOD_OPTIONS_BY_GROUP[groupBy][0];
    if (firstOption) {
      setSelectedPeriod(firstOption.periods);
    }
  }, [groupBy]);

  useRealtimeCashflowUpdates({
    ownerId,
    onRefresh: fetchCashFlowData,
    enabled: true,
    tables: ['transactions', 'budgets'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
    pollingIntervalMs: 0,
    refreshOnFocus: false,
    refreshOnVisibility: false,
  });

  const chartData = useMemo(() => {
    // Usar timezone do Brasil (UTC-3) para determinar o mês atual
    const today = new Date();
    const brazilDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentYear = brazilDate.getFullYear();
    const currentMonth = brazilDate.getMonth() + 1; // 1-12
    const currentQuarter = Math.ceil(currentMonth / 3);

    // Buscar mais dados para permitir navegação
    // Para anos, precisamos de mais dados
    const totalMonthsBack = groupBy === 'year' ? 180 : (groupBy === 'quarter' ? 48 : 24);
    const totalMonthsForward = groupBy === 'year' ? 180 : (groupBy === 'quarter' ? 48 : 24);

    const startDate = new Date(currentYear, currentMonth - 1 - totalMonthsBack, 1);
    const endDate = new Date(currentYear, currentMonth - 1 + totalMonthsForward, 1);
    endDate.setMonth(endDate.getMonth() + 1, 0);

    // Primeiro, coletar todos os dados mensais
    const monthlyData: Array<{
      month: string;
      monthLabel: string;
      income: number;
      expenses: number;
      balance: number;
      isCurrentMonth: boolean;
      isProjected: boolean;
      income_actual: number;
      income_planned: number;
      expenses_actual: number;
      expenses_planned: number;
      year: number;
      monthNum: number;
      quarter: number;
    }> = [];

    let current = new Date(startDate);
    let safetyCounter = 0;

    while (current <= endDate && safetyCounter < 500) {
      safetyCounter++;
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const quarter = Math.ceil(month / 3);
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const totals = cashFlowData[monthKey] || {
        planned_income: 0,
        planned_expenses: 0,
        actual_income: 0,
        actual_expenses: 0,
      };

      const isCurrentMonth = year === currentYear && month === currentMonth;
      const isProjected = year > currentYear || (year === currentYear && month > currentMonth);

      let income: number;
      let expenses: number;

      if (isCurrentMonth) {
        income = totals.actual_income > 0 ? totals.actual_income : totals.planned_income;
        expenses = totals.actual_expenses > 0 ? totals.actual_expenses : totals.planned_expenses;
      } else if (isProjected) {
        income = totals.planned_income;
        expenses = totals.planned_expenses;
      } else {
        income = totals.actual_income;
        expenses = totals.actual_expenses;
      }

      monthlyData.push({
        month: monthKey,
        monthLabel: current.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        income: income / 100,
        expenses: expenses / 100,
        balance: (income - expenses) / 100,
        isCurrentMonth,
        isProjected: isProjected && !isCurrentMonth,
        income_actual: totals.actual_income / 100,
        income_planned: totals.planned_income / 100,
        expenses_actual: totals.actual_expenses / 100,
        expenses_planned: totals.planned_expenses / 100,
        year,
        monthNum: month,
        quarter,
      });

      current.setMonth(current.getMonth() + 1);
    }

    // Se agrupamento é por mês, retornar dados mensais diretamente
    if (groupBy === 'month') {
      return monthlyData;
    }

    // Agrupar por trimestre ou ano
    const groupedData: Map<string, typeof monthlyData[0]> = new Map();

    for (const item of monthlyData) {
      let groupKey: string;
      let groupLabel: string;

      if (groupBy === 'quarter') {
        groupKey = `${item.year}-Q${item.quarter}`;
        groupLabel = `Q${item.quarter}/${String(item.year).slice(-2)}`;
      } else {
        // year
        groupKey = `${item.year}`;
        groupLabel = `${item.year}`;
      }

      const existing = groupedData.get(groupKey);

      if (existing) {
        // Somar valores
        existing.income += item.income;
        existing.expenses += item.expenses;
        existing.balance += item.balance;
        existing.income_actual += item.income_actual;
        existing.income_planned += item.income_planned;
        existing.expenses_actual += item.expenses_actual;
        existing.expenses_planned += item.expenses_planned;
        // isCurrentMonth/isProjected: se qualquer mês no grupo for atual, o grupo é atual
        if (item.isCurrentMonth) existing.isCurrentMonth = true;
        // isProjected: só se TODOS os meses forem projetados
        if (!item.isProjected && !item.isCurrentMonth) existing.isProjected = false;
      } else {
        groupedData.set(groupKey, {
          ...item,
          month: groupKey,
          monthLabel: groupLabel,
          // Para trimestre/ano atual
          isCurrentMonth: groupBy === 'quarter'
            ? (item.year === currentYear && item.quarter === currentQuarter)
            : (item.year === currentYear),
          isProjected: groupBy === 'quarter'
            ? (item.year > currentYear || (item.year === currentYear && item.quarter > currentQuarter))
            : (item.year > currentYear),
        });
      }
    }

    return Array.from(groupedData.values());
  }, [cashFlowData, groupBy]);

  const projectedBalance = useMemo(() => {
    if (!data) return 0;

    const today = new Date();
    const brazilDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const monthKey = `${brazilDate.getFullYear()}-${String(brazilDate.getMonth() + 1).padStart(2, '0')}`;
    const totals = cashFlowData[monthKey];

    if (!totals) return data.totalBalance;

    const plannedNet = (totals.planned_income || 0) - (totals.planned_expenses || 0);
    const actualNet = (totals.actual_income || 0) - (totals.actual_expenses || 0);
    const remainingNet = plannedNet - actualNet;

    return data.totalBalance + remainingNet / 100;
  }, [cashFlowData, data]);

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="max-w-full animate-slide-in-left">
        <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 max-w-full animate-children-stagger">
        <div className="glass-card p-3 md:p-5 hover-lift animate-float-slow" style={{ animationDelay: '0s' }}>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center animate-pulse-soft">
                <i className='bx bx-wallet text-lg md:text-xl text-primary'></i>
              </div>
              <span className="text-xs md:text-sm text-muted-foreground">Saldo Total</span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa a soma de todos os seus saldos em contas bancárias e investimentos.</li>
                    <li>Valores positivos indicam ativos, enquanto valores negativos indicam passivos.</li>
                    <li>Este valor é atualizado automaticamente ao adicionar novas contas ou transações.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className="font-display text-lg md:text-2xl font-bold">
            {data ? formatCurrency(data.totalBalance) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-3 md:p-5 hover-lift animate-float-slow" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-blue-500/10 flex items-center justify-center animate-pulse-soft">
                  <i className='bx bx-bar-chart text-lg md:text-xl text-blue-500'></i>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground">Saldo Projetado</span>
              </div>
              <span className="text-[10px] md:text-xs text-primary font-medium ml-1 flex items-center gap-1">
                <i className='bx bx-calendar text-xs'></i>
                Mês Atual ({currentMonthName})
              </span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Projeta o saldo total ao final do <strong>mês atual ({currentMonthName})</strong>.</li>
                    <li>Considera receitas e despesas planejadas restantes do mês.</li>
                    <li>Se não houver projeções, mostra o saldo atual.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className="font-display text-lg md:text-2xl font-bold text-blue-500">
            {data ? formatCurrency(projectedBalance) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-3 md:p-5 hover-lift animate-float-slow" style={{ animationDelay: '1s' }}>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-positive/10 flex items-center justify-center animate-pulse-soft">
                  <i className='bx bx-trending-up text-lg md:text-xl text-positive'></i>
                </div>
                <span className="text-xs md:text-sm font-semibold text-foreground">
                  Receitas
                </span>
              </div>
              <span className="text-[10px] md:text-xs text-primary font-medium ml-1 flex items-center gap-1">
                <i className='bx bx-calendar text-xs'></i>
                Mês Atual ({currentMonthName})
              </span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa todas as entradas de dinheiro no <strong>mês atual ({currentMonthName})</strong>.</li>
                    <li>Inclui salários, freelas, aluguéis, dividendos e outras fontes de receita.</li>
                    <li>Valores são calculados com base nas transações registradas.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className="font-display text-lg md:text-2xl font-bold text-positive">
            {data ? formatCurrency(data.totalIncome) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-3 md:p-5 hover-lift animate-float-slow" style={{ animationDelay: '1.5s' }}>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-negative/10 flex items-center justify-center animate-pulse-soft">
                  <i className='bx bx-trending-down text-lg md:text-xl text-negative'></i>
                </div>
                <span className="text-xs md:text-sm font-semibold text-foreground">
                  Despesas
                </span>
              </div>
              <span className="text-[10px] md:text-xs text-primary font-medium ml-1 flex items-center gap-1">
                <i className='bx bx-calendar text-xs'></i>
                Mês Atual ({currentMonthName})
              </span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa todas as saídas de dinheiro no <strong>mês atual ({currentMonthName})</strong>.</li>
                    <li>Inclui despesas fixas, variáveis e eventuais registradas como transações.</li>
                    <li>Valores são calculados com base nas transações registradas.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className="font-display text-lg md:text-2xl font-bold text-negative">
            {data ? formatCurrency(data.totalExpenses) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-3 md:p-5 hover-lift animate-float-slow" style={{ animationDelay: '2s' }}>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-secondary/10 flex items-center justify-center animate-pulse-soft">
                  <i className='bx bx-pie-chart text-lg md:text-xl text-secondary'></i>
                </div>
                <span className="text-xs md:text-sm font-semibold text-foreground">
                  Economia
                </span>
              </div>
              <span className="text-[10px] md:text-xs text-primary font-medium ml-1 flex items-center gap-1">
                <i className='bx bx-calendar text-xs'></i>
                Mês Atual ({currentMonthName})
              </span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa a diferença entre receitas e despesas do <strong>mês atual ({currentMonthName})</strong> (Receitas - Despesas).</li>
                    <li>Valores positivos indicam que você economizou dinheiro.</li>
                    <li>Valores negativos indicam que você gastou mais do que recebeu.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className={`font-display text-lg md:text-2xl font-bold ${data && data.savings >= 0 ? 'text-positive' : 'text-negative'
            }`}>
            {data ? formatCurrency(data.savings) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 w-full min-w-0">
        <div className="lg:col-span-2 glass-card p-4 md:p-6 animate-slide-in-up delay-300 w-full min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-sm md:text-base">Fluxo de Caixa</h2>
              <InfoIcon
                content={
                  <div className="space-y-2">
                    <p className="font-semibold">Sobre este gráfico:</p>
                    <ul className="space-y-1.5 text-xs list-disc list-inside">
                      <li><strong>Receitas:</strong> Valores recebidos no período. Barras mais apagadas indicam projeções.</li>
                      <li><strong>Despesas:</strong> Valores gastos no período. Barras mais apagadas indicam projeções.</li>
                      <li><strong>Saldo Acumulado:</strong> Soma acumulada de receitas menos despesas ao longo do tempo.</li>
                      <li><strong>Linha tracejada:</strong> Indica valores projetados (futuros).</li>
                      <li><strong>◆ MÊS ATUAL ◆:</strong> Área destacada em azul indica o mês corrente.</li>
                      <li>O mês atual sempre aparece centralizado no gráfico, com histórico à esquerda e projeções à direita.</li>
                    </ul>
                  </div>
                }
              />
            </div>
            <div className="flex items-center gap-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {/* Agrupar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Agrupar:</span>
                {GROUP_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={groupBy === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGroupBy(option.value)}
                    className={`flex-shrink-0 text-xs md:text-sm px-2 md:px-3 ${groupBy === option.value
                      ? 'bg-muted text-foreground hover:bg-muted/80 hover:text-foreground'
                      : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground border-border'
                      }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {/* Visualizar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Visualizar:</span>
                {PERIOD_OPTIONS_BY_GROUP[groupBy].map((option) => (
                  <Button
                    key={option.periods}
                    variant={selectedPeriod === option.periods ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod(option.periods)}
                    className={`flex-shrink-0 text-xs md:text-sm px-2 md:px-3 ${selectedPeriod === option.periods
                      ? 'bg-muted text-foreground hover:bg-muted/80 hover:text-foreground'
                      : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground border-border'
                      }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          {cashFlowLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground">Carregando gráfico...</div>
            </div>
          ) : chartData.length > 0 ? (
            <CashFlowChart
              data={chartData}
              periodCount={isFree ? 0 : selectedPeriod}
              groupBy={groupBy}
            />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground">Nenhum dado disponível</div>
            </div>
          )}
        </div>

        <LockedFeatureWrapper
          featureId="ai_advisor"
          minPlan="pro"
          planFeatures={planFeatures}
          userPlan={userProfile?.plan}
        >
          <AdvisorTips />
        </LockedFeatureWrapper>
      </div>

      <div className="animate-slide-in-up delay-400">
        <ExpensesByCategoryChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:items-stretch items-start w-full">
        <LockedFeatureWrapper
          featureId="budgets"
          minPlan="pro"
          planFeatures={planFeatures}
          userPlan={userProfile?.plan}
        >
          <div ref={budgetsContainerRef} className="w-full min-w-0 animate-slide-in-left delay-500">
            <BudgetsByCategory />
          </div>
        </LockedFeatureWrapper>
        <div className="glass-card p-3 md:p-6 flex flex-col w-full min-w-0 animate-slide-in-right delay-500 hover-lift">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-display font-semibold text-sm md:text-base whitespace-nowrap">Transações Recentes</h2>
              <InfoIcon
                content={
                  <div className="space-y-2">
                    <p className="font-semibold">Sobre esta seção:</p>
                    <ul className="space-y-1.5 text-xs list-disc list-inside">
                      <li>Mostra as últimas transações registradas em suas contas.</li>
                      <li>As transações são ordenadas da mais recente para a mais antiga.</li>
                      <li>Valores positivos representam receitas, valores negativos representam despesas.</li>
                      <li>Clique em "Ver todas" para acessar a lista completa de transações.</li>
                    </ul>
                  </div>
                }
              />
            </div>
            <Link href="/app/transactions" className="text-xs md:text-sm text-primary hover:underline whitespace-nowrap flex-shrink-0">
              Ver todas
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-muted-foreground">
              <p className="text-sm">Nenhuma transação encontrada</p>
              <Link href="/app/transactions" className="text-primary hover:underline mt-2 inline-block text-sm">
                Adicionar transação
              </Link>
            </div>
          ) : (
            <div className="flex-1 w-full min-w-0">
              {/* Mobile: Card view */}
              <div className="md:hidden space-y-1.5 w-full">
                {recentTransactions.slice(0, 9).map((tx) => {
                  const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                  const isIncome = amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {tx.categories?.name || 'Sem categoria'} • {new Date(tx.posted_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <p className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${isIncome ? 'text-positive' : 'text-negative'}`}>
                        {isIncome ? '+' : ''}{formatCurrency(amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Tablet: Compact table view */}
              <div className="hidden md:block lg:hidden w-full">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-[45%]">Descrição</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground w-[25%]">Data</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground w-[30%]">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, 9).map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-2 text-xs">
                          <div className="truncate" title={tx.description}>
                            {tx.description}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {tx.categories?.name || 'Sem categoria'}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {new Date(tx.posted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td
                          className={`py-2 px-2 text-xs text-right font-medium ${(() => {
                            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                            return amount > 0 ? 'text-positive' : 'text-negative';
                          })()
                            }`}
                        >
                          {(() => {
                            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                            return amount > 0 ? '+' : '';
                          })()}
                          {formatCurrency(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Desktop: Full table view */}
              <div className="hidden lg:block w-full">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[30%]">Descrição</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[25%]">Categoria</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[20%]">Data</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-[25%]">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, maxVisibleItems).map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-2 text-sm">
                          <div className="truncate" title={tx.description}>
                            {tx.description}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="badge-pill text-xs truncate inline-block max-w-full">
                            {tx.categories?.name || 'Sem categoria'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">
                          {new Date(tx.posted_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td
                          className={`py-3 px-2 text-sm text-right font-medium ${(() => {
                            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                            return amount > 0 ? 'text-positive' : 'text-negative';
                          })()
                            }`}
                        >
                          {(() => {
                            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                            return amount > 0 ? '+' : '';
                          })()}
                          {formatCurrency(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
