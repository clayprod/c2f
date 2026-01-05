'use client';

import { useState, useEffect, useMemo } from 'react';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Progress } from '@/components/ui/progress';
import { InfoIcon } from '@/components/ui/InfoIcon';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Budget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount_planned: number;
  amount_actual?: number;
  categories?: Category;
  is_projected?: boolean;
}

export function BudgetsByCategory() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      // Use include_projections to get all budgets including projections for the selected month
      const res = await fetch(`/api/budgets?include_projections=true&start_month=${selectedMonth}&end_month=${selectedMonth}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch budgets');
      }

      const data = await res.json();
      // When include_projections is true, budgets are in data.data.budgets
      const allBudgets = data.data?.budgets || data.data || [];
      
      // Filter budgets for the selected month (year and month match)
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      
      const monthBudgets = allBudgets.filter((b: Budget) => {
        return b.year === year && b.month === month;
      });
      
      setBudgets(monthBudgets);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate max date (current month + 6 months)
  const maxDate = useMemo(() => {
    const now = new Date();
    const maxMonth = new Date(now);
    maxMonth.setMonth(maxMonth.getMonth() + 6);
    return {
      year: maxMonth.getFullYear(),
      month: maxMonth.getMonth() + 1,
    };
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Validate selected month is within allowed range
  const isMonthValid = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Calculate max month
    const maxMonthDate = new Date(now);
    maxMonthDate.setMonth(maxMonthDate.getMonth() + 6);
    const maxYear = maxMonthDate.getFullYear();
    const maxMonth = maxMonthDate.getMonth() + 1;
    
    // Check if month is within range (current to current + 6)
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return false;
    }
    if (year > maxYear || (year === maxYear && month > maxMonth)) {
      return false;
    }
    return true;
  }, [selectedMonth]);

  // Generate list of available months
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i <= 6; i++) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() + i);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      months.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return months;
  }, []);

  // Reset to current month if selected month is invalid
  useEffect(() => {
    if (!isMonthValid && selectedMonth !== availableMonths[0]) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [isMonthValid, selectedMonth, availableMonths]);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold">Orçamentos por Categoria</h2>
          <InfoIcon
            content={
              <div className="space-y-2">
                <p className="font-semibold">Sobre esta seção:</p>
                <ul className="space-y-1.5 text-xs list-disc list-inside">
                  <li>Mostra os orçamentos para o mês selecionado.</li>
                  <li>Inclui orçamentos manuais e projeções automáticas.</li>
                  <li>A barra de progresso indica o consumo em relação ao limite planejado.</li>
                  <li>Valores são calculados com base nas projeções e transações realizadas.</li>
                </ul>
              </div>
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mês:</span>
          <div className="w-[200px]">
            <MonthYearPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              maxYear={maxDate.year}
              minYear={new Date().getFullYear()}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-muted-foreground">Carregando orçamentos...</div>
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum orçamento encontrado para {formatMonthLabel(selectedMonth)}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => {
            const spent = Math.abs(budget.amount_actual || 0);
            const limit = Math.abs(budget.amount_planned || 0);
            const percentage = limit > 0 ? (spent / limit) * 100 : 0;
            const isOver = spent > limit;
            const categoryName = budget.categories?.name || 'Sem categoria';

            return (
              <div
                key={budget.id}
                className="p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
              >
                <div className="mb-3">
                  <h3 className="font-semibold text-sm mb-1 uppercase">{categoryName}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Gasto:</span>
                    <span className={`font-medium ${isOver ? 'text-red-500' : 'text-foreground'}`}>
                      {formatCurrency(spent)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Limite:</span>
                    <span className="font-medium">{formatCurrency(limit)}</span>
                  </div>
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={`h-2 ${isOver ? 'bg-red-500/20' : ''}`}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Consumo:</span>
                    <span className={`font-semibold ${isOver ? 'text-red-500' : 'text-foreground'}`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

