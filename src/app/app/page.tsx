'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { BudgetsByCategory } from '@/components/dashboard/BudgetsByCategory';
import { AdvisorTips } from '@/components/dashboard/AdvisorTips';
import { Button } from '@/components/ui/button';
import { InfoIcon } from '@/components/ui/InfoIcon';

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState<Record<string, MonthlyTotal>>({});
  const [cashFlowLoading, setCashFlowLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(12); // Default: 1 year

  useEffect(() => {
    fetchDashboardData();
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

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

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

      setRecentTransactions(transactions.slice(0, 5));
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
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      
      // Start: 5 months back from current month
      const startDate = new Date(currentYear, currentMonth - 5, 1);
      
      // End: selectedPeriod months forward from current month
      // Limit to max 10 years (120 months total from start)
      // We have 5 months back, so max 115 months forward
      const maxMonthsForward = Math.min(selectedPeriod, 115);
      
      // Calculate end date: add months to current date
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + maxMonthsForward);
      // Set to last day of that month
      endDate.setMonth(endDate.getMonth() + 1, 0);

      // Double-check period doesn't exceed 120 months total
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                         (endDate.getMonth() - startDate.getMonth() + 1);
      if (monthsDiff > 120) {
        console.warn('Período excede 10 anos, limitando a 10 anos');
        const limitedEndDate = new Date(startDate);
        limitedEndDate.setMonth(limitedEndDate.getMonth() + 120);
        endDate.setTime(limitedEndDate.getTime());
      }
      
      // Ensure end date is not before start date
      if (endDate < startDate) {
        console.error('Data final anterior à data inicial');
        setCashFlowLoading(false);
        return;
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
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const startDate = new Date(currentYear, currentMonth - 6, 1); // 5 months back
    const endDate = new Date(currentYear, currentMonth + selectedPeriod, 0); // selectedPeriod months forward

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
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const totals = cashFlowData[monthKey] || {
        planned_income: 0,
        planned_expenses: 0,
        actual_income: 0,
        actual_expenses: 0,
      };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <i className='bx bx-wallet text-xl text-primary'></i>
              </div>
              <span className="text-sm text-muted-foreground">Saldo Total</span>
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
          <p className="font-display text-2xl font-bold">
            {data ? formatCurrency(data.totalBalance) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <i className='bx bx-trending-up text-xl text-green-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Receitas (Mês)</span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa todas as entradas de dinheiro no mês atual.</li>
                    <li>Inclui salários, freelas, aluguéis, dividendos e outras fontes de receita.</li>
                    <li>Valores são calculados com base nas transações registradas.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className="font-display text-2xl font-bold text-green-500">
            {data ? formatCurrency(data.totalIncome) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <i className='bx bx-trending-down text-xl text-red-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Despesas (Mês)</span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa todas as saídas de dinheiro no mês atual.</li>
                    <li>Inclui despesas fixas, variáveis e eventuais registradas como transações.</li>
                    <li>Valores são calculados com base nas transações registradas.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className="font-display text-2xl font-bold text-red-500">
            {data ? formatCurrency(data.totalExpenses) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <i className='bx bx-pie-chart text-xl text-secondary'></i>
              </div>
              <span className="text-sm text-muted-foreground">Economia (Mês)</span>
            </div>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre este valor:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Representa a diferença entre receitas e despesas do mês (Receitas - Despesas).</li>
                    <li>Valores positivos indicam que você economizou dinheiro.</li>
                    <li>Valores negativos indicam que você gastou mais do que recebeu.</li>
                  </ul>
                </div>
              }
            />
          </div>
          <p className={`font-display text-2xl font-bold ${
            data && data.savings >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {data ? formatCurrency(data.savings) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold">Fluxo de Caixa</h2>
              <InfoIcon
                content={
                  <div className="space-y-2">
                    <p className="font-semibold">Sobre este gráfico:</p>
                    <ul className="space-y-1.5 text-xs list-disc list-inside">
                      <li><strong>Receitas:</strong> Valores recebidos no período. Barras mais apagadas indicam projeções.</li>
                      <li><strong>Despesas:</strong> Valores gastos no período. Barras mais apagadas indicam projeções.</li>
                      <li><strong>Saldo Acumulado:</strong> Soma acumulada de receitas menos despesas ao longo do tempo.</li>
                      <li><strong>Linha tracejada:</strong> Indica valores projetados (futuros).</li>
                      <li><strong>Fundo azul:</strong> Destaca o mês corrente.</li>
                      <li>O mês corrente está sempre centralizado, com histórico à esquerda e projeções à direita.</li>
                    </ul>
                  </div>
                }
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Período:</span>
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.months}
                  variant={selectedPeriod === option.months ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod(option.months)}
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
            <CashFlowChart data={chartData} periodMonths={selectedPeriod} />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-muted-foreground">Nenhum dado disponível</div>
            </div>
          )}
        </div>

        <AdvisorTips />
      </div>

      <ExpensesByCategoryChart />

      <div className="grid lg:grid-cols-2 gap-6">
        <BudgetsByCategory />
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold">Transações Recentes</h2>
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
            <Link href="/app/transactions" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma transação encontrada</p>
            <Link href="/app/transactions" className="text-primary hover:underline mt-2 inline-block">
              Adicionar transação
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm">{tx.description}</td>
                    <td className="py-3 px-4">
                      <span className="badge-pill text-xs">
                        {tx.categories?.name || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(tx.posted_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td
                      className={`py-3 px-4 text-sm text-right font-medium ${
                        (() => {
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
          )}
        </div>
      </div>
    </div>
  );
}