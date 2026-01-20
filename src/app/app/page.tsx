'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { BudgetsByCategory } from '@/components/dashboard/BudgetsByCategory';
import { AdvisorTips } from '@/components/dashboard/AdvisorTips';
import { Button } from '@/components/ui/button';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { useProfile } from '@/hooks/useProfile';
import { PlanGuard } from '@/components/app/PlanGuard';

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

const PERIOD_OPTIONS = [
  { label: '6 meses', months: 6 },
  { label: '1 ano', months: 12 },
  { label: '2 anos', months: 24 },
  { label: '5 anos', months: 60 },
  // 10 anos removed - max is 115 months forward (5 back + 115 forward = 120 total)
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Função para obter o nome do mês atual no timezone do Brasil (UTC-3)
const getCurrentMonthName = () => {
  const now = new Date();
  // Converter para timezone do Brasil (America/Sao_Paulo = UTC-3)
  const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brazilDate.toLocaleDateString('pt-BR', { month: 'long' });
};

// Updated: 2026-01-18 - Melhorias na indicação do mês corrente
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState<Record<string, MonthlyTotal>>({});
  const [cashFlowLoading, setCashFlowLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(12); // Default: 1 year
  const { isFree, loading: profileLoading } = useProfile();
  const [maxVisibleItems, setMaxVisibleItems] = useState(9);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (window.innerWidth >= 1024) { // Only on desktop (lg)
        const height = entry.contentRect.height;
        // Approx item height (row + border) is ~53px. 
        // Using 50px to be slightly aggressive/fill more, 55px to be safe.
        // Let's use 55px to avoid partial rows.
        const count = Math.floor(height / 55);
        setMaxVisibleItems(Math.max(5, count));
      } else {
        setMaxVisibleItems(9);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading]); // Re-attach if loading state changes layout, though mostly static ref.

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

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCashFlowData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

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

  const fetchCashFlowData = async () => {
    try {
      setCashFlowLoading(true);
      // Usar timezone do Brasil (UTC-3)
      const today = new Date();
      const brazilDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentYear = brazilDate.getFullYear();
      const currentMonth = brazilDate.getMonth();

      // Calculate ranges prioritizing future
      // We want to show current month, so available slots for others is selectedPeriod - 1
      const monthsBack = Math.floor((selectedPeriod - 1) / 2);
      const monthsForward = selectedPeriod - 1 - monthsBack;

      // Start: monthsBack months back from current
      const startDate = new Date(currentYear, currentMonth - monthsBack, 1);

      // End: monthsForward months forward from current
      const endDate = new Date(currentYear, currentMonth + monthsForward, 1);
      // Set to last day of that month
      endDate.setMonth(endDate.getMonth() + 1, 0);

      // Limit check (max 10 years total)
      if (selectedPeriod > 120) {
        console.warn('Período excede 10 anos');
      }

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
  };

  const chartData = useMemo(() => {
    // Usar timezone do Brasil (UTC-3) para determinar o mês atual
    const today = new Date();
    const brazilDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentYear = brazilDate.getFullYear();
    const currentMonth = brazilDate.getMonth() + 1; // 1-12

    // Logic matching fetchCashFlowData
    const monthsBack = Math.floor((selectedPeriod - 1) / 2);
    const monthsForward = selectedPeriod - 1 - monthsBack;

    // currentMonth in calculation is 1-based (from brazildate.getMonth() + 1)
    // Date constructor expects 0-based month.
    // So currentMonth - 1 is the 0-based index of current month.
    const startDate = new Date(currentYear, currentMonth - 1 - monthsBack, 1);

    const endDate = new Date(currentYear, currentMonth - 1 + monthsForward, 1);
    endDate.setMonth(endDate.getMonth() + 1, 0);

    const months: Array<{
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
    }> = [];

    let current = new Date(startDate);
    // Safety break to prevent infinite loops if dates are messed up
    let safetyCounter = 0;

    while (current <= endDate && safetyCounter < 150) {
      safetyCounter++;
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const totals = cashFlowData[monthKey] || {
        planned_income: 0,
        planned_expenses: 0,
        actual_income: 0,
        actual_expenses: 0,
      };

      // Comparar usando timezone do Brasil
      const isCurrentMonth = year === currentYear && month === currentMonth;
      const isProjected = year > currentYear || (year === currentYear && month > currentMonth);

      // Para mês corrente: usar valores reais se existirem, senão usar projetados
      // Para meses passados: sempre usar valores reais
      // Para meses futuros: sempre usar valores projetados
      let income: number;
      let expenses: number;

      if (isCurrentMonth) {
        // Mês corrente: preferir valores reais, mas usar projetados se não houver reais
        income = totals.actual_income > 0 ? totals.actual_income : totals.planned_income;
        expenses = totals.actual_expenses > 0 ? totals.actual_expenses : totals.planned_expenses;
      } else if (isProjected) {
        // Mês futuro: sempre projetado
        income = totals.planned_income;
        expenses = totals.planned_expenses;
      } else {
        // Mês passado: sempre real
        income = totals.actual_income;
        expenses = totals.actual_expenses;
      }

      months.push({
        month: monthKey,
        monthLabel: current.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        income: income / 100, // Convert from cents
        expenses: expenses / 100,
        balance: (income - expenses) / 100,
        isCurrentMonth,
        isProjected: isProjected && !isCurrentMonth, // Mês corrente não é projetado se tiver valores reais
        income_actual: totals.actual_income / 100,
        income_planned: totals.planned_income / 100,
        expenses_actual: totals.actual_expenses / 100,
        expenses_planned: totals.planned_expenses / 100,
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [cashFlowData, selectedPeriod]);

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="max-w-full">
        <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-full">
        <div className="glass-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center">
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

        <div className="glass-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-green-500/10 flex items-center justify-center">
                  <i className='bx bx-trending-up text-lg md:text-xl text-green-500'></i>
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
          <p className="font-display text-lg md:text-2xl font-bold text-green-500">
            {data ? formatCurrency(data.totalIncome) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-red-500/10 flex items-center justify-center">
                  <i className='bx bx-trending-down text-lg md:text-xl text-red-500'></i>
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
          <p className="font-display text-lg md:text-2xl font-bold text-red-500">
            {data ? formatCurrency(data.totalExpenses) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-3 md:p-5">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-secondary/10 flex items-center justify-center">
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
          <p className={`font-display text-lg md:text-2xl font-bold ${data && data.savings >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
            {data ? formatCurrency(data.savings) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 glass-card p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
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
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap flex-shrink-0">Período:</span>
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.months}
                  variant={selectedPeriod === option.months ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(option.months)}
                  className="flex-shrink-0 text-xs md:text-sm px-2 md:px-3"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {cashFlowLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground">Carregando gráfico...</div>
            </div>
          ) : chartData.length > 0 ? (
            <CashFlowChart
              data={chartData}
              periodMonths={isFree ? 0 : selectedPeriod}
            />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground">Nenhum dado disponível</div>
            </div>
          )}
        </div>

        <PlanGuard minPlan="pro" showFallback={false}>
          <AdvisorTips />
        </PlanGuard>
      </div>

      <ExpensesByCategoryChart />

      <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <PlanGuard minPlan="pro" showFallback={false}>
          <BudgetsByCategory />
        </PlanGuard>
        <div className="glass-card p-4 md:p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-sm md:text-base">Transações Recentes</h2>
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
            <Link href="/app/transactions" className="text-xs md:text-sm text-primary hover:underline">
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
            <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
              {/* Mobile: Card view */}
              <div className="md:hidden space-y-2">
                {recentTransactions.slice(0, 9).map((tx) => {
                  const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                  const isIncome = amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.categories?.name || 'Sem categoria'} • {new Date(tx.posted_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold whitespace-nowrap ${isIncome ? 'text-green-500' : 'text-red-500'}`}>
                        {isIncome ? '+' : ''}{formatCurrency(amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Tablet: Compact table view */}
              <div className="hidden md:block lg:hidden overflow-x-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Data</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, 9).map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3 text-xs min-w-0">
                          <div className="truncate max-w-[200px]" title={tx.description}>{tx.description}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {tx.categories?.name || 'Sem categoria'}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(tx.posted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td
                          className={`py-2 px-3 text-xs text-right font-medium whitespace-nowrap ${(() => {
                            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                            return amount > 0 ? 'text-green-500' : 'text-red-500';
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
              <div className="hidden lg:block overflow-x-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Categoria</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, maxVisibleItems).map((tx) => (
                      <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-sm min-w-0 max-w-[150px] xl:max-w-[300px]">
                          <div className="truncate" title={tx.description}>{tx.description}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="badge-pill text-xs">
                            {tx.categories?.name || 'Sem categoria'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(tx.posted_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td
                          className={`py-3 px-4 text-sm text-right font-medium whitespace-nowrap ${(() => {
                            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                            return amount > 0 ? 'text-green-500' : 'text-red-500';
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