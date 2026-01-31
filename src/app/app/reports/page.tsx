'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceArea,
} from 'recharts';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { formatMonthYear, formatCurrency } from '@/lib/utils';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { PlanGuard } from '@/components/app/PlanGuard';
import { useMembers } from '@/hooks/useMembers';

interface PeriodData {
  period: string;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
  cumulative_balance_cents?: number;
}

interface CategoryData {
  category: string;
  categoryId: string | null;
  total_cents: number;
  count: number;
  percentage: number;
  smallCategories?: CategoryData[]; // For "Outros" category grouping
}

interface BudgetData {
  category: string;
  categoryId: string;
  budgeted_cents: number;
  spent_cents: number;
  remaining_cents: number;
  percentage: number;
  status: 'under' | 'near' | 'over';
}

interface GoalData {
  id: string;
  name: string;
  target_cents: number;
  current_cents: number;
  remaining_cents: number;
  progress: number;
  status: string;
  target_date: string | null;
  days_remaining: number | null;
  monthly_needed_cents: number | null;
}

interface DebtData {
  id: string;
  name: string;
  total_cents: number;
  paid_cents: number;
  remaining_cents: number;
  progress: number;
  status: string;
  interest_rate: number;
  due_date: string | null;
  days_until_due: number | null;
}

interface InvestmentData {
  id: string;
  name: string;
  type: string;
  invested_cents: number;
  current_value_cents: number;
  return_cents: number;
  return_percentage: number;
  status: string;
}

interface InvestmentByType {
  type: string;
  invested_cents: number;
  current_value_cents: number;
  return_cents: number;
  return_percentage: number;
  count: number;
  allocation_percentage: number;
}

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

// Paleta de cores baseada no design system c2Finance
const COLORS = [
  '#1FC0D2', // Strong Cyan (primary)
  '#9448BC', // Amethyst (secondary)
  '#73FBD3', // Aquamarine (accent)
  '#59D2FE', // Sky Aqua
  '#44E5E7', // Neon Ice
  '#FED766', // Mustard (warning)
  '#FE4A49', // Tomato (destructive)
  '#7C5CBF', // Amethyst lighter
  '#2DD4BF', // Teal variation
  '#A78BFA', // Purple variation
];

const TYPE_LABELS: Record<string, string> = {
  stocks: 'Ações',
  bonds: 'Renda Fixa',
  funds: 'Fundos',
  crypto: 'Criptomoedas',
  real_estate: 'Imoveis',
  other: 'Outros',
};

// Helper function to compact small categories into "Outros"
function compactCategories(categories: CategoryData[], threshold: number = 1): CategoryData[] {
  const mainCategories: CategoryData[] = [];
  const smallCategories: CategoryData[] = [];

  categories.forEach((cat) => {
    if (cat.percentage > threshold) {
      mainCategories.push(cat);
    } else {
      smallCategories.push(cat);
    }
  });

  if (smallCategories.length > 0) {
    const othersTotal = smallCategories.reduce((sum, cat) => sum + cat.total_cents, 0);
    const othersCount = smallCategories.reduce((sum, cat) => sum + cat.count, 0);
    const total = categories.reduce((sum, cat) => sum + cat.total_cents, 0);
    const othersPercentage = total > 0 ? (othersTotal / total) * 100 : 0;

    mainCategories.push({
      category: 'Outros',
      categoryId: '__others__',
      total_cents: othersTotal,
      count: othersCount,
      percentage: othersPercentage,
      smallCategories,
    });
  }

  return mainCategories;
}

// Custom tooltip component for category pie charts
const CategoryPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isOthers = data.categoryId === '__others__' && data.smallCategories;

    return (
      <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl max-w-xs z-50">
        <p className="font-semibold mb-1 text-foreground">{data.category}</p>
        <p className="text-sm font-medium text-primary">
          {formatCurrency(data.total_cents)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {data.percentage.toFixed(1)}% do total
        </p>
        {isOthers && data.smallCategories.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1.5">
              Inclui {data.smallCategories.length} categoria{data.smallCategories.length > 1 ? 's' : ''}:
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {data.smallCategories.map((cat: CategoryData, idx: number) => (
                <div key={cat.categoryId || idx} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-foreground/80 truncate">{cat.category}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatCurrency(cat.total_cents)} ({cat.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('month');

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter options
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');
  const { members } = useMembers();

  // Report data
  const [overviewData, setOverviewData] = useState<{
    summary: {
      total_income_cents: number;
      total_expense_cents: number;
      balance_cents: number;
      savings_rate: number;
      transaction_count: number;
    };
    periods: PeriodData[];
  } | null>(null);

  const [categoriesData, setCategoriesData] = useState<{
    income: { total_cents: number; categories: CategoryData[] };
    expense: { total_cents: number; categories: CategoryData[] };
  } | null>(null);

  const [budgetsData, setBudgetsData] = useState<{
    summary: {
      total_budgeted_cents: number;
      total_spent_cents: number;
      total_remaining_cents: number;
      overall_percentage: number;
    };
    budgets: BudgetData[];
  } | null>(null);

  const [goalsData, setGoalsData] = useState<{
    summary: {
      total_goals: number;
      active_goals: number;
      completed_goals: number;
      total_target_cents: number;
      total_current_cents: number;
      overall_progress: number;
    };
    goals: GoalData[];
  } | null>(null);

  const [debtsData, setDebtsData] = useState<{
    summary: {
      total_debts: number;
      active_debts: number;
      overdue_debts: number;
      total_debt_cents: number;
      total_paid_cents: number;
      total_remaining_cents: number;
      overall_progress: number;
    };
    debts: DebtData[];
  } | null>(null);

  const [investmentsData, setInvestmentsData] = useState<{
    summary: {
      total_investments: number;
      total_invested_cents: number;
      total_current_value_cents: number;
      total_return_cents: number;
      total_return_percentage: number;
    };
    by_type: InvestmentByType[];
    investments: InvestmentData[];
  } | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate, groupBy, selectedAccountIds, selectedCategoryIds, selectedAssignedTo]);

  const fetchFilterOptions = async () => {
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);
      const [accountsData, categoriesData] = await Promise.all([
        accountsRes.json(),
        categoriesRes.json(),
      ]);
      setAccounts(accountsData.data || []);
      setCategories(categoriesData.data || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        reportType: activeTab,
        groupBy,
      });
      if (startDate) {
        params.set('startDate', startDate);
      }
      if (endDate) {
        params.set('endDate', endDate);
      }
      if (selectedAccountIds.length) {
        params.set('accountIds', selectedAccountIds.join(','));
      }
      if (selectedCategoryIds.length) {
        params.set('categoryIds', selectedCategoryIds.join(','));
      }
      if (selectedAssignedTo) {
        params.set('assignedTo', selectedAssignedTo);
      }

      const res = await fetch(`/api/reports?${params}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Erro ao carregar relatório');
      }

      switch (activeTab) {
        case 'overview':
          setOverviewData(result.data);
          break;
        case 'categories':
          setCategoriesData(result.data);
          break;
        case 'budgets':
          setBudgetsData(result.data);
          break;
        case 'goals':
          setGoalsData(result.data);
          break;
        case 'debts':
          setDebtsData(result.data);
          break;
        case 'investments':
          setInvestmentsData(result.data);
          break;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Falha ao carregar relatório',
        description: message || 'Não foi possível carregar os dados do relatório. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType: string) => {
    try {
      setExporting(true);
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
          reportType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          accountIds: selectedAccountIds.length ? selectedAccountIds : undefined,
          categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao exportar');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `relatorio_${reportType}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado com sucesso',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Falha ao exportar relatório',
        description: message || 'Não foi possível exportar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const formatPeriodLabel = (period: string, index?: number, data?: any[]) => {
    if (period.length === 4) return period; // Year
    if (period.length === 7) {
      // Formato YYYY-MM - usar formatMonthYear
      const monthInfoResult = formatMonthYear(period, { returnCurrentMonthInfo: true });
      const formatted = typeof monthInfoResult === 'string' ? monthInfoResult : monthInfoResult.formatted;
      return formatted;
    }
    // Para datas completas (dia/mês), parsear diretamente para evitar problemas de timezone
    const datePart = period.split('T')[0];
    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const day = dayStr?.padStart(2, '0') || '01';
    const monthNum = parseInt(monthStr, 10);
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day} ${monthNames[monthNum - 1] || ''}`;
  };

  const formatTooltipLabel = (label: any) => {
    return formatPeriodLabel(label);
  };

  // Função para encontrar índice do mês corrente nos dados
  const findCurrentMonthIndex = (data: PeriodData[]): number => {
    if (!data || data.length === 0) return -1;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return data.findIndex((item) => {
      if (item.period.length === 7) {
        const [year, month] = item.period.split('-');
        return parseInt(year) === currentYear && parseInt(month) === currentMonth;
      }
      return false;
    });
  };

  // Função para reorganizar dados e centralizar mês corrente (mesma lógica do dashboard)
  const reorganizeDataForChart = (data: PeriodData[], periodMonths: number = 12): { data: PeriodData[]; currentMonthIndex: number } => {
    if (!data || data.length === 0) {
      return { data: [], currentMonthIndex: -1 };
    }

    const currentMonthIdx = findCurrentMonthIndex(data);

    if (currentMonthIdx < 0) {
      return { data, currentMonthIndex: -1 };
    }

    // Dividir em histórico, mês corrente e projeção
    const historicalData = data.slice(0, currentMonthIdx);
    const currentMonthData = [data[currentMonthIdx]];
    const projectedData = data.slice(currentMonthIdx + 1);

    // Calcular quantos períodos mostrar antes e depois
    const halfPeriod = Math.floor(periodMonths / 2);
    const periodsBefore = Math.min(halfPeriod, historicalData.length);
    const periodsAfter = Math.min(halfPeriod, projectedData.length);

    // Pegar últimos N períodos históricos e primeiros N períodos projetados
    const selectedHistorical = historicalData.slice(-periodsBefore);
    const selectedProjected = projectedData.slice(0, periodsAfter);

    // Combinar: histórico + mês corrente + projeção
    const reorganizedData = [
      ...selectedHistorical,
      ...currentMonthData,
      ...selectedProjected,
    ];

    return {
      data: reorganizedData,
      currentMonthIndex: selectedHistorical.length,
    };
  };

  const formatChartValue = (value: number) => {
    return formatCurrency(value);
  };

  if (loading && !overviewData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <PlanGuard minPlan="premium">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Analise seus dados financeiros</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('summary')}
              disabled={exporting}
            >
              <i className='bx bx-download mr-2'></i>
              {exporting ? 'Exportando...' : 'Exportar Resumo'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium mb-1">Periodo</label>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onDateChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Agrupar por</label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Conta</label>
              <Select
                value={selectedAccountIds[0] || 'all'}
                onValueChange={(v) => setSelectedAccountIds(v === 'all' ? [] : [v])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <Select
                value={selectedCategoryIds[0] || 'all'}
                onValueChange={(v) => setSelectedCategoryIds(v === 'all' ? [] : [v])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {members.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-1">Responsavel</label>
                <Select
                  value={selectedAssignedTo || 'all'}
                  onValueChange={(v) => setSelectedAssignedTo(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px]">Visao Geral</TabsTrigger>
            <TabsTrigger value="categories" className="flex-1 min-w-[100px]">Categorias</TabsTrigger>
            <TabsTrigger value="budgets" className="flex-1 min-w-[100px]">Orçamentos</TabsTrigger>
            <TabsTrigger value="goals" className="flex-1 min-w-[100px]">Objetivos</TabsTrigger>
            <TabsTrigger value="debts" className="flex-1 min-w-[100px]">Dívidas</TabsTrigger>
            <TabsTrigger value="investments" className="flex-1 min-w-[100px]">Investimentos</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {overviewData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-positive/10 flex items-center justify-center">
                        <i className='bx bx-trending-up text-xl text-positive'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Receitas</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-positive">
                      {formatCurrency(overviewData.summary.total_income_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-negative/10 flex items-center justify-center">
                        <i className='bx bx-trending-down text-xl text-negative'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Despesas</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-negative">
                      {formatCurrency(overviewData.summary.total_expense_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${overviewData.summary.balance_cents >= 0 ? 'bg-primary/10' : 'bg-negative/10'
                        }`}>
                        <i className={`bx bx-wallet text-xl ${overviewData.summary.balance_cents >= 0 ? 'text-primary' : 'text-negative'
                          }`}></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Saldo</span>
                    </div>
                    <p className={`font-display text-2xl font-bold ${overviewData.summary.balance_cents >= 0 ? 'text-primary' : 'text-negative'
                      }`}>
                      {formatCurrency(overviewData.summary.balance_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <i className='bx bx-pie-chart-alt text-xl text-cyan-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Taxa de Poupanca</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-cyan-500">
                      {overviewData.summary.savings_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Chart */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-lg">Receitas vs Despesas</h3>
                      <InfoIcon
                        content={
                          <div className="space-y-2">
                            <p className="font-semibold">Sobre este gráfico:</p>
                            <ul className="space-y-1.5 text-xs list-disc list-inside">
                              <li><strong>Receitas:</strong> Valores recebidos no período selecionado.</li>
                              <li><strong>Despesas:</strong> Valores gastos no período selecionado.</li>
                              <li><strong>Barra azul:</strong> Destaca o mês/período corrente.</li>
                              <li>O período corrente está sempre centralizado quando aplicável.</li>
                              <li>Use os filtros acima para ajustar o período e visualizar diferentes intervalos de tempo.</li>
                            </ul>
                          </div>
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExport('transactions')}
                      disabled={exporting}
                    >
                      <i className='bx bx-download mr-1'></i> CSV
                    </Button>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const reorganized = reorganizeDataForChart(overviewData.periods);
                        return (
                          <BarChart data={reorganized.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="period"
                              tickFormatter={(value, index) => formatPeriodLabel(value, index, reorganized.data)}
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            {reorganized.currentMonthIndex >= 0 && reorganized.currentMonthIndex < reorganized.data.length && (
                              <ReferenceArea
                                x1={reorganized.data[reorganized.currentMonthIndex]?.period}
                                x2={reorganized.data[reorganized.currentMonthIndex]?.period}
                                y1="dataMin"
                                y2="dataMax"
                                fill="hsl(var(--primary))"
                                fillOpacity={0.1}
                                stroke="none"
                                ifOverflow="extendDomain"
                              />
                            )}
                            <YAxis
                              tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip
                              formatter={(value: number) => formatChartValue(value)}
                              labelFormatter={formatTooltipLabel}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Legend />
                            <Bar dataKey="income_cents" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense_cents" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        );
                      })()}
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            {categoriesData && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Income by Category */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div>
                        <h3 className="font-display font-semibold text-lg">Receitas por Categoria</h3>
                        <p className="text-sm text-muted-foreground">
                          Total: {formatCurrency(categoriesData.income.total_cents)}
                        </p>
                      </div>
                      <InfoIcon
                        content={
                          <div className="space-y-2">
                            <p className="font-semibold">Sobre este gráfico:</p>
                            <ul className="space-y-1.5 text-xs list-disc list-inside">
                              <li>Mostra como suas receitas estão distribuídas entre diferentes categorias.</li>
                              <li>Cada barra representa uma categoria de receita e seu valor total no período.</li>
                              <li>As categorias são ordenadas do maior para o menor valor recebido.</li>
                              <li>Use este gráfico para identificar suas principais fontes de renda.</li>
                            </ul>
                          </div>
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExport('categories')}
                      disabled={exporting}
                    >
                      <i className='bx bx-download mr-1'></i> CSV
                    </Button>
                  </div>
                  {categoriesData.income.categories.length > 0 ? (
                    (() => {
                      const compactedIncome = compactCategories(categoriesData.income.categories);
                      return (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={compactedIncome}
                                dataKey="total_cents"
                                nameKey="category"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                                labelLine={false}
                              >
                                {compactedIncome.map((cat, index) => (
                                  <Cell
                                    key={index}
                                    fill={cat.categoryId === '__others__' ? '#6B7280' : COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<CategoryPieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma receita no período</p>
                  )}
                  <div className="space-y-2 mt-4">
                    {(() => {
                      const compactedIncome = compactCategories(categoriesData.income.categories);
                      return compactedIncome.slice(0, 5).map((cat, i) => (
                        <div key={cat.categoryId || i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.categoryId === '__others__' ? '#6B7280' : COLORS[i % COLORS.length] }}
                            />
                            <span>{cat.category}</span>
                            {cat.smallCategories && (
                              <span className="text-xs text-muted-foreground">
                                ({cat.smallCategories.length})
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{formatCurrency(cat.total_cents)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Expense by Category */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div>
                        <h3 className="font-display font-semibold text-lg">Despesas por Categoria</h3>
                        <p className="text-sm text-muted-foreground">
                          Total: {formatCurrency(categoriesData.expense.total_cents)}
                        </p>
                      </div>
                      <InfoIcon
                        content={
                          <div className="space-y-2">
                            <p className="font-semibold">Sobre este gráfico:</p>
                            <ul className="space-y-1.5 text-xs list-disc list-inside">
                              <li>Mostra como suas despesas estão distribuídas entre diferentes categorias.</li>
                              <li>Cada fatia do gráfico representa uma categoria de despesa e seu valor total no período.</li>
                              <li>As categorias são ordenadas do maior para o menor valor gasto.</li>
                              <li>Use este gráfico para identificar onde você está gastando mais dinheiro.</li>
                            </ul>
                          </div>
                        }
                      />
                    </div>
                  </div>
                  {categoriesData.expense.categories.length > 0 ? (
                    (() => {
                      const compactedExpense = compactCategories(categoriesData.expense.categories);
                      return (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={compactedExpense}
                                dataKey="total_cents"
                                nameKey="category"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                                labelLine={false}
                              >
                                {compactedExpense.map((cat, index) => (
                                  <Cell
                                    key={index}
                                    fill={cat.categoryId === '__others__' ? '#6B7280' : COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<CategoryPieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma despesa no período</p>
                  )}
                  <div className="space-y-2 mt-4">
                    {(() => {
                      const compactedExpense = compactCategories(categoriesData.expense.categories);
                      return compactedExpense.slice(0, 5).map((cat, i) => (
                        <div key={cat.categoryId || i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.categoryId === '__others__' ? '#6B7280' : COLORS[i % COLORS.length] }}
                            />
                            <span>{cat.category}</span>
                            {cat.smallCategories && (
                              <span className="text-xs text-muted-foreground">
                                ({cat.smallCategories.length})
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{formatCurrency(cat.total_cents)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-6">
            {budgetsData && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <i className='bx bx-target-lock text-xl text-primary'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Total Orcado</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(budgetsData.summary.total_budgeted_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                        <i className='bx bx-credit-card text-xl text-yellow-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Total Gasto</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(budgetsData.summary.total_spent_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${budgetsData.summary.total_remaining_cents >= 0 ? 'bg-positive/10' : 'bg-negative/10'
                        }`}>
                        <i className={`bx bx-check-circle text-xl ${budgetsData.summary.total_remaining_cents >= 0 ? 'text-positive' : 'text-negative'
                          }`}></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Disponivel</span>
                    </div>
                    <p className={`font-display text-2xl font-bold ${budgetsData.summary.total_remaining_cents >= 0 ? 'text-positive' : 'text-negative'
                      }`}>
                      {formatCurrency(budgetsData.summary.total_remaining_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <i className='bx bx-pie-chart-alt text-xl text-cyan-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">% Utilizado</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {budgetsData.summary.overall_percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Budget Chart */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-lg">Orçamento vs Gasto por Categoria</h3>
                      <InfoIcon
                        content={
                          <div className="space-y-2">
                            <p className="font-semibold">Sobre este gráfico:</p>
                            <ul className="space-y-1.5 text-xs list-disc list-inside">
                              <li>Compara o valor orçado com o valor efetivamente gasto em cada categoria.</li>
                              <li>Barras azuis representam o valor planejado para cada categoria.</li>
                              <li>Barras laranjas representam o valor efetivamente gasto em cada categoria.</li>
                              <li>Use este gráfico para identificar categorias onde você está gastando mais do que planejou.</li>
                            </ul>
                          </div>
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExport('budgets')}
                      disabled={exporting}
                    >
                      <i className='bx bx-download mr-1'></i> CSV
                    </Button>
                  </div>
                  {budgetsData.budgets.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={budgetsData.budgets} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis
                            type="category"
                            dataKey="category"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            width={100}
                          />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                          <Bar dataKey="budgeted_cents" name="Orcado" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="spent_cents" name="Gasto" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum orçamento no período</p>
                  )}
                </div>

                {/* Budget List */}
                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left py-4 px-6 font-medium">Categoria</th>
                          <th className="text-right py-4 px-6 font-medium">Orcado</th>
                          <th className="text-right py-4 px-6 font-medium">Gasto</th>
                          <th className="text-right py-4 px-6 font-medium">Restante</th>
                          <th className="text-center py-4 px-6 font-medium">Progresso</th>
                          <th className="text-center py-4 px-6 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetsData.budgets.map((budget) => (
                          <tr key={budget.categoryId} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="py-4 px-6 font-medium">{budget.category}</td>
                            <td className="py-4 px-6 text-right">{formatCurrency(budget.budgeted_cents)}</td>
                            <td className="py-4 px-6 text-right">{formatCurrency(budget.spent_cents)}</td>
                            <td className={`py-4 px-6 text-right ${budget.remaining_cents < 0 ? 'text-negative' : 'text-positive'}`}>
                              {formatCurrency(budget.remaining_cents)}
                            </td>
                            <td className="py-4 px-6">
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${budget.status === 'over' ? 'bg-negative' :
                                    budget.status === 'near' ? 'bg-warning' : 'bg-positive'
                                    }`}
                                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${budget.status === 'over' ? 'bg-negative/10 text-negative' :
                                budget.status === 'near' ? 'bg-warning/10 text-yellow-500' :
                                  'bg-positive/10 text-positive'
                                }`}>
                                {budget.percentage.toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-6">
            {goalsData && goalsData.summary ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <i className='bx bx-flag text-xl text-primary'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Total Objetivos</span>
                    </div>
                    <p className="font-display text-2xl font-bold">{goalsData.summary.total_goals || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {goalsData.summary.active_goals || 0} ativos, {goalsData.summary.completed_goals || 0} concluidos
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <i className='bx bx-target-lock text-xl text-cyan-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Meta Total</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(goalsData.summary.total_target_cents || 0)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-positive/10 flex items-center justify-center">
                        <i className='bx bx-coin text-xl text-positive'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Acumulado</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-positive">
                      {formatCurrency(goalsData.summary.total_current_cents || 0)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <i className='bx bx-line-chart text-xl text-purple-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Progresso Geral</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {(goalsData.summary.overall_progress || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Goals List */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display font-semibold text-lg">Progresso dos Objetivos</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExport('goals')}
                      disabled={exporting}
                    >
                      <i className='bx bx-download mr-1'></i> CSV
                    </Button>
                  </div>
                  {goalsData.goals.length > 0 ? (
                    <div className="space-y-4">
                      {goalsData.goals.map((goal) => (
                        <div key={goal.id} className="p-4 bg-muted/30 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{goal.name}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${goal.status === 'completed' ? 'bg-positive/10 text-positive' :
                              goal.status === 'active' ? 'bg-primary/10 text-primary' :
                                'bg-muted text-muted-foreground'
                              }`}>
                              {goal.status === 'completed' ? 'Concluido' :
                                goal.status === 'active' ? 'Ativo' :
                                  goal.status === 'paused' ? 'Pausado' : 'Cancelado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>{formatCurrency(goal.current_cents)} de {formatCurrency(goal.target_cents)}</span>
                            {goal.days_remaining !== null && goal.days_remaining > 0 && (
                              <span>| {goal.days_remaining} dias restantes</span>
                            )}
                            {goal.monthly_needed_cents !== null && goal.monthly_needed_cents > 0 && (
                              <span>| {formatCurrency(goal.monthly_needed_cents)}/mês necessário</span>
                            )}
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div
                              className="h-3 rounded-full bg-gradient-to-r from-primary to-cyan-500"
                              style={{ width: `${Math.min(goal.progress, 100)}%` }}
                            />
                          </div>
                          <p className="text-right text-sm font-medium mt-1">{goal.progress.toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum objetivo cadastrado</p>
                  )}
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* Debts Tab */}
          <TabsContent value="debts" className="space-y-6">
            {debtsData && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-negative/10 flex items-center justify-center">
                        <i className='bx bx-credit-card text-xl text-negative'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Dívidas Ativas</span>
                    </div>
                    <p className="font-display text-2xl font-bold">{debtsData.summary.active_debts}</p>
                    {debtsData.summary.overdue_debts > 0 && (
                      <p className="text-xs text-negative mt-1">{debtsData.summary.overdue_debts} em atraso</p>
                    )}
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                        <i className='bx bx-dollar-circle text-xl text-orange-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Total Dívidas</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(debtsData.summary.total_debt_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-positive/10 flex items-center justify-center">
                        <i className='bx bx-check text-xl text-positive'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Total Pago</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-positive">
                      {formatCurrency(debtsData.summary.total_paid_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                        <i className='bx bx-timer text-xl text-yellow-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Restante</span>
                    </div>
                    <p className="font-display text-2xl font-bold text-yellow-500">
                      {formatCurrency(debtsData.summary.total_remaining_cents)}
                    </p>
                  </div>
                </div>

                {/* Debts Chart */}
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display font-semibold text-lg">Progresso de Pagamento</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExport('debts')}
                      disabled={exporting}
                    >
                      <i className='bx bx-download mr-1'></i> CSV
                    </Button>
                  </div>
                  {debtsData.debts.length > 0 ? (
                    <div className="space-y-4">
                      {debtsData.debts.map((debt) => (
                        <div key={debt.id} className="p-4 bg-muted/30 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{debt.name}</h4>
                              {debt.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  Vencimento: {(() => {
                                    const [y, m, d] = debt.due_date!.split('T')[0].split('-');
                                    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
                                  })()}
                                  {debt.days_until_due !== null && (
                                    <span className={debt.days_until_due < 0 ? ' text-negative' : ''}>
                                      {' '}({debt.days_until_due < 0 ? `${Math.abs(debt.days_until_due)} dias atrasado` : `${debt.days_until_due} dias`})
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${debt.status === 'paid' ? 'bg-positive/10 text-positive' :
                              debt.status === 'overdue' ? 'bg-negative/10 text-negative' :
                                debt.status === 'negotiating' ? 'bg-warning/10 text-yellow-500' :
                                  'bg-primary/10 text-primary'
                              }`}>
                              {debt.status === 'paid' ? 'Pago' :
                                debt.status === 'overdue' ? 'Atrasado' :
                                  debt.status === 'negotiating' ? 'Negociando' : 'Ativo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>Pago: {formatCurrency(debt.paid_cents)} de {formatCurrency(debt.total_cents)}</span>
                            {debt.interest_rate > 0 && <span>| Juros: {debt.interest_rate}%</span>}
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${debt.status === 'paid' ? 'bg-positive' :
                                debt.status === 'overdue' ? 'bg-negative' : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                                }`}
                              style={{ width: `${Math.min(debt.progress, 100)}%` }}
                            />
                          </div>
                          <p className="text-right text-sm font-medium mt-1">{debt.progress.toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma divida cadastrada</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="space-y-6">
            {investmentsData && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <i className='bx bx-bar-chart text-xl text-primary'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Total Investido</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(investmentsData.summary.total_invested_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <i className='bx bx-wallet text-xl text-cyan-500'></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Valor Atual</span>
                    </div>
                    <p className="font-display text-2xl font-bold">
                      {formatCurrency(investmentsData.summary.total_current_value_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${investmentsData.summary.total_return_cents >= 0 ? 'bg-positive/10' : 'bg-negative/10'
                        }`}>
                        <i className={`bx bx-trending-up text-xl ${investmentsData.summary.total_return_cents >= 0 ? 'text-positive' : 'text-negative'
                          }`}></i>
                      </div>
                      <span className="text-sm text-muted-foreground">Retorno</span>
                    </div>
                    <p className={`font-display text-2xl font-bold ${investmentsData.summary.total_return_cents >= 0 ? 'text-positive' : 'text-negative'
                      }`}>
                      {formatCurrency(investmentsData.summary.total_return_cents)}
                    </p>
                  </div>

                  <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${investmentsData.summary.total_return_percentage >= 0 ? 'bg-positive/10' : 'bg-negative/10'
                        }`}>
                        <i className={`bx bx-percentage text-xl ${investmentsData.summary.total_return_percentage >= 0 ? 'text-positive' : 'text-negative'}`}></i>
                      </div>
                      <span className="text-sm text-muted-foreground">% Retorno</span>
                    </div>
                    <p className={`font-display text-2xl font-bold ${investmentsData.summary.total_return_percentage >= 0 ? 'text-positive' : 'text-negative'
                      }`}>
                      {investmentsData.summary.total_return_percentage >= 0 ? '+' : ''}{investmentsData.summary.total_return_percentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Allocation Chart */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display font-semibold text-lg">Alocacao por Tipo</h3>
                    </div>
                    {investmentsData.by_type.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={investmentsData.by_type.map(t => ({
                                ...t,
                                name: TYPE_LABELS[t.type] || t.type,
                              }))}
                              dataKey="current_value_cents"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, allocation_percentage }) => `${name}: ${allocation_percentage.toFixed(1)}%`}
                              labelLine={false}
                            >
                              {investmentsData.by_type.map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Nenhum investimento cadastrado</p>
                    )}
                  </div>

                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display font-semibold text-lg">Retorno por Tipo</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport('investments')}
                        disabled={exporting}
                      >
                        <i className='bx bx-download mr-1'></i> CSV
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {investmentsData.by_type.map((type, i) => (
                        <div key={type.type} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-medium">{TYPE_LABELS[type.type] || type.type}</span>
                            <span className="text-sm text-muted-foreground">({type.count})</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(type.current_value_cents)}</p>
                            <p className={`text-sm ${type.return_percentage >= 0 ? 'text-positive' : 'text-negative'}`}>
                              {type.return_percentage >= 0 ? '+' : ''}{type.return_percentage.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Investments Table */}
                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left py-4 px-6 font-medium">Nome</th>
                          <th className="text-left py-4 px-6 font-medium">Tipo</th>
                          <th className="text-right py-4 px-6 font-medium">Investido</th>
                          <th className="text-right py-4 px-6 font-medium">Valor Atual</th>
                          <th className="text-right py-4 px-6 font-medium">Retorno</th>
                          <th className="text-center py-4 px-6 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investmentsData.investments.map((inv) => (
                          <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="py-4 px-6 font-medium">{inv.name}</td>
                            <td className="py-4 px-6">{TYPE_LABELS[inv.type] || inv.type}</td>
                            <td className="py-4 px-6 text-right">{formatCurrency(inv.invested_cents)}</td>
                            <td className="py-4 px-6 text-right">{formatCurrency(inv.current_value_cents)}</td>
                            <td className={`py-4 px-6 text-right ${inv.return_percentage >= 0 ? 'text-positive' : 'text-negative'}`}>
                              {inv.return_percentage >= 0 ? '+' : ''}{inv.return_percentage.toFixed(2)}%
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === 'active' ? 'bg-positive/10 text-positive' :
                                inv.status === 'sold' ? 'bg-muted text-muted-foreground' :
                                  'bg-warning/10 text-yellow-500'
                                }`}>
                                {inv.status === 'active' ? 'Ativo' : inv.status === 'sold' ? 'Vendido' : 'Vencido'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </PlanGuard>
  );
}
