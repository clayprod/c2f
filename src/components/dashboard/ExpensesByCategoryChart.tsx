'use client';

import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { formatCurrencyValue } from '@/lib/utils';

// Hook para detectar tamanho da tela
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}

interface CategoryExpense {
  category: string;
  categoryId: string;
  total: number;
  percentage: number;
  color?: string;
}

interface Transaction {
  id: string;
  amount: number | string;
  category_id: string;
  categories?: {
    id: string;
    name: string;
    color?: string;
  };
}

interface Budget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount_planned_cents?: number;
  limit_cents?: number;
  categories?: {
    id: string;
    name: string;
    type?: string;
    color?: string;
  };
  is_projected?: boolean;
}

const COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316',
];

export function ExpensesByCategoryChart() {
  const windowSize = useWindowSize();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projections, setProjections] = useState<Budget[]>([]);

  // Calcular raios do gráfico baseado no tamanho da tela
  const { innerRadius, outerRadius } = useMemo(() => {
    const width = windowSize.width;
    if (width >= 1280) { // xl
      return { innerRadius: 60, outerRadius: 85 };
    } else if (width >= 1024) { // lg
      return { innerRadius: 50, outerRadius: 70 };
    } else {
      return { innerRadius: 40, outerRadius: 55 };
    }
  }, [windowSize.width]);

  const [year, month] = useMemo(() => {
    const parts = selectedMonth.split('-');
    return [parseInt(parts[0]), parseInt(parts[1])];
  }, [selectedMonth]);

  // Check if selected month is in the future
  const isFutureMonth = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    return year > currentYear || (year === currentYear && month > currentMonth);
  }, [year, month]);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true);

        if (isFutureMonth) {
          // For future months, fetch projections from budgets API
          const res = await fetch(
            `/api/budgets?include_projections=true&start_month=${selectedMonth}&end_month=${selectedMonth}`
          );

          if (!res.ok) {
            throw new Error('Failed to fetch projections');
          }

          const data = await res.json();
          const allBudgets = data.data?.budgets || data.data || [];

          // Filter budgets for the selected month (expenses only)
          const monthBudgets = allBudgets.filter((b: Budget) => {
            const matchesMonth = b.year === year && b.month === month;
            const category = b.categories;
            const isExpense = !category || category.type === 'expense' || !category.type;
            return matchesMonth && isExpense;
          });

          setProjections(monthBudgets);
          setTransactions([]);
        } else {
          // For past/current months, fetch actual transactions
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0); // Last day of the month

          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];

          const res = await fetch(
            `/api/transactions?type=expense&from_date=${startDateStr}&to_date=${endDateStr}&limit=1000`
          );

          if (!res.ok) {
            throw new Error('Failed to fetch expenses');
          }

          const data = await res.json();
          setTransactions(data.data || []);
          setProjections([]);
        }
      } catch (error) {
        console.error('Error fetching expenses:', error);
        setTransactions([]);
        setProjections([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [selectedMonth, isFutureMonth, year, month]);

  const categoryExpenses = useMemo(() => {
    const grouped: Record<string, { category: string; categoryId: string; total: number; color?: string }> = {};

    if (isFutureMonth && projections.length > 0) {
      // Group by category from projections (budgets)
      projections.forEach((budget) => {
        const categoryId = budget.category_id;
        const categoryName = budget.categories?.name || 'Sem categoria';
        const categoryColor = budget.categories?.color;
        const amount = Math.abs((budget.limit_cents || budget.amount_planned_cents || 0) / 100);

        if (!categoryId) return;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {
            category: categoryName,
            categoryId,
            total: 0,
            color: categoryColor,
          };
        }

        grouped[categoryId].total += amount;
      });
    } else {
      // Group by category from transactions
      transactions.forEach((tx) => {
        const categoryId = tx.category_id;
        const categoryName = tx.categories?.name || 'Sem categoria';
        const categoryColor = tx.categories?.color;
        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        const absoluteAmount = Math.abs(amount);

        if (!categoryId) return;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {
            category: categoryName,
            categoryId,
            total: 0,
            color: categoryColor,
          };
        }

        grouped[categoryId].total += absoluteAmount;
      });
    }

    const expenses = Object.values(grouped);
    const total = expenses.reduce((sum, item) => sum + item.total, 0);

    return expenses
      .map((item) => ({
        ...item,
        percentage: total > 0 ? (item.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, projections, isFutureMonth]);

  // Alias para manter compatibilidade
  const formatCurrency = formatCurrencyValue;

  const totalExpenses = categoryExpenses.reduce((sum, item) => sum + item.total, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold mb-1 text-foreground">{data.category}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color }} />
            <p className="text-sm font-medium" style={{ color: payload[0].color }}>
              {formatCurrency(data.total)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.percentage.toFixed(1)}% do total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card px-3 md:px-4 py-1.5 md:py-2 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-1.5 md:mb-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-sm md:text-lg leading-none">Gastos por Categoria</h2>
          <InfoIcon
            content={
              <div className="space-y-2">
                <p className="font-semibold text-primary">Sobre este gráfico:</p>
                <ul className="space-y-1.5 text-xs list-disc list-inside text-muted-foreground">
                  <li>Mostra como suas despesas estão distribuídas entre diferentes categorias.</li>
                  <li>Cada fatia do gráfico representa uma categoria de despesa e seu valor total.</li>
                  <li>As categorias são ordenadas do maior para o menor valor gasto.</li>
                  <li>Use este gráfico para identificar onde você está gastando mais dinheiro.</li>
                </ul>
              </div>
            }
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <MonthYearPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        </div>
      ) : categoryExpenses.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">📊</span>
            </div>
            <p className="text-muted-foreground">Nenhuma despesa neste período</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 md:gap-3 lg:gap-4">
            <div className="h-[160px] md:h-[200px] lg:h-[240px] xl:h-[280px] relative flex-shrink-0 lg:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryExpenses}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categoryExpenses.map((item, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={item.color || COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                    <Label
                      content={({ viewBox }: any) => {
                        const { cx, cy } = viewBox;
                        return (
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                            <tspan
                              x={cx}
                              y={cy - 8}
                              className="fill-muted-foreground text-[8px] md:text-[10px] uppercase font-medium"
                            >
                              Total Gasto
                            </tspan>
                            <tspan
                              x={cx}
                              y={cy + 12}
                              className="fill-foreground text-sm md:text-lg font-bold"
                            >
                              {formatCurrency(totalExpenses).replace('R$', '').trim()}
                            </tspan>
                          </text>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:w-[220px] lg:max-h-[300px] lg:overflow-y-auto lg:pr-2 scrollbar-thin">
              {categoryExpenses.slice(0, 6).map((item, index) => (
                <div
                  key={item.categoryId}
                  className="group flex flex-col gap-0.5 p-1.5 md:p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs md:text-sm gap-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div
                        className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-foreground/90 truncate text-[10px] md:text-xs">
                        {item.category}
                      </span>
                    </div>
                    <span className="font-bold text-foreground text-[10px] md:text-xs whitespace-nowrap">
                      {formatCurrency(item.total).replace('R$', '').trim()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 h-1 md:h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: item.color || COLORS[index % COLORS.length],
                        width: `${item.percentage}%`
                      }}
                    />
                  </div>
                </div>
              ))}
              {categoryExpenses.length > 6 && (
                <p className="text-[9px] md:text-[10px] text-center text-muted-foreground pt-1 col-span-2 sm:col-span-3 lg:col-span-1">
                  + {categoryExpenses.length - 6} outras categorias
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

