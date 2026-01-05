'use client';

import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { InfoIcon } from '@/components/ui/InfoIcon';

interface CategoryExpense {
  category: string;
  categoryId: string;
  total: number;
  percentage: number;
}

interface Transaction {
  id: string;
  amount: number | string;
  category_id: string;
  categories?: {
    id: string;
    name: string;
  };
}

interface Budget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount_planned: number;
  categories?: {
    id: string;
    name: string;
    type?: string;
  };
  is_projected?: boolean;
}

// Helper function to generate month options (3 back, current, 3 forward)
const generateMonthOptions = () => {
  const options: Array<{ label: string; value: string; year: number; month: number }> = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  for (let i = -3; i <= 3; i++) {
    const date = new Date(currentYear, currentMonth + i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    
    options.push({
      label: monthLabel,
      value: monthKey,
      year,
      month,
    });
  }
  
  return options;
};

const COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#f97316',
];

export function ExpensesByCategoryChart() {
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const currentMonthIndex = 3; // Index of current month (middle of 7 months)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(currentMonthIndex);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projections, setProjections] = useState<Budget[]>([]);

  // Check if selected month is in the future
  const isFutureMonth = useMemo(() => {
    const selectedMonth = monthOptions[selectedMonthIndex];
    if (!selectedMonth) return false;
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    return selectedMonth.year > currentYear || 
           (selectedMonth.year === currentYear && selectedMonth.month > currentMonth);
  }, [selectedMonthIndex, monthOptions]);

  useEffect(() => {
    const selectedMonth = monthOptions[selectedMonthIndex];
    if (!selectedMonth) return;

    const fetchExpenses = async () => {
      try {
        setLoading(true);
        
        if (isFutureMonth) {
          // For future months, fetch projections from budgets API
          const monthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
          const res = await fetch(
            `/api/budgets?include_projections=true&start_month=${monthKey}&end_month=${monthKey}`
          );

          if (!res.ok) {
            throw new Error('Failed to fetch projections');
          }

          const data = await res.json();
          const allBudgets = data.data?.budgets || data.data || [];
          
          // Filter budgets for the selected month (expenses only)
          const monthBudgets = allBudgets.filter((b: Budget) => {
            const matchesMonth = b.year === selectedMonth.year && b.month === selectedMonth.month;
            const category = b.categories;
            const isExpense = !category || category.type === 'expense' || !category.type;
            return matchesMonth && isExpense;
          });
          
          setProjections(monthBudgets);
          setTransactions([]);
        } else {
          // For past/current months, fetch actual transactions
          const startDate = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
          const endDate = new Date(selectedMonth.year, selectedMonth.month, 0); // Last day of the month

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
  }, [selectedMonthIndex, monthOptions, isFutureMonth]);

  const categoryExpenses = useMemo(() => {
    const grouped: Record<string, { category: string; categoryId: string; total: number }> = {};

    if (isFutureMonth && projections.length > 0) {
      // Group by category from projections (budgets)
      projections.forEach((budget) => {
        const categoryId = budget.category_id;
        const categoryName = budget.categories?.name || 'Sem categoria';
        const amount = Math.abs(budget.amount_planned || 0);

        if (!categoryId) return;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {
            category: categoryName,
            categoryId,
            total: 0,
          };
        }

        grouped[categoryId].total += amount;
      });
    } else {
      // Group by category from transactions
      transactions.forEach((tx) => {
        const categoryId = tx.category_id;
        const categoryName = tx.categories?.name || 'Sem categoria';
        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        const absoluteAmount = Math.abs(amount);

        if (!categoryId) return;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {
            category: categoryName,
            categoryId,
            total: 0,
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalExpenses = categoryExpenses.reduce((sum, item) => sum + item.total, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.category}</p>
          <p className="text-sm" style={{ color: payload[0].color }}>
            {formatCurrency(data.total)}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.percentage.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold">Gastos por Categoria</h2>
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Mês:</span>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {monthOptions.map((option, index) => (
              <Button
                key={option.value}
                variant={selectedMonthIndex === index ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMonthIndex(index)}
                className="whitespace-nowrap flex-shrink-0"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-muted-foreground">Carregando dados...</div>
        </div>
      ) : categoryExpenses.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-muted-foreground">Nenhuma despesa no mês selecionado</div>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatCurrency(totalExpenses)}</span>
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryExpenses}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                    labelLine={false}
                  >
                    {categoryExpenses.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {categoryExpenses.slice(0, 10).map((item, index) => (
                <div key={item.categoryId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span>{item.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(item.total)}</span>
                    <span className="text-muted-foreground ml-2">({item.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

