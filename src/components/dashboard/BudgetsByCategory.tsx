'use client';

import { useState, useEffect, useMemo } from 'react';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Progress } from '@/components/ui/progress';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
  icon?: string;
}

interface Budget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount_planned_cents?: number;
  limit_cents?: number;
  amount_actual?: number;
  categories?: Category;
  is_projected?: boolean;
}

type FilterStatus = 'all' | 'over' | 'warning' | 'ok';

export function BudgetsByCategory() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/budgets?include_projections=true&start_month=${selectedMonth}&end_month=${selectedMonth}`);

      if (!res.ok) {
        throw new Error('Failed to fetch budgets');
      }

      const data = await res.json();
      const allBudgets = data.data?.budgets || data.data || [];

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredBudgets = useMemo(() => {
    return budgets.filter(budget => {
      const spent = Math.abs(budget.amount_actual || 0);
      const limit = Math.abs((budget.limit_cents || budget.amount_planned_cents || 0) / 100);
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;

      if (statusFilter === 'over') return percentage > 100;
      if (statusFilter === 'warning') return percentage >= 80 && percentage <= 100;
      if (statusFilter === 'ok') return percentage < 80;
      return true;
    }).sort((a, b) => {
      const pA = (Math.abs(a.amount_actual || 0) / Math.abs((a.limit_cents || a.amount_planned_cents || 1) / 100)) * 100;
      const pB = (Math.abs(b.amount_actual || 0) / Math.abs((b.limit_cents || b.amount_planned_cents || 1) / 100)) * 100;
      return pB - pA;
    });
  }, [budgets, statusFilter]);

  return (
    <div className="glass-card p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col gap-3 mb-4 md:mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-sm md:text-lg">Orçamentos por Categoria</h2>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold text-primary">Sobre esta seção:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside text-muted-foreground">
                    <li>Mostra os orçamentos para o mês selecionado.</li>
                    <li>A barra de progresso indica o consumo em relação ao limite.</li>
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Acima do limite (&gt;100%)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Próximo ao limite (80-100%)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Dentro do limite (&lt;80%)
                    </li>
                  </ul>
                </div>
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 md:h-9 gap-1.5 text-xs md:text-sm">
                <Filter className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Status: {
                  statusFilter === 'all' ? 'Todos' :
                    statusFilter === 'over' ? 'Acima' :
                      statusFilter === 'warning' ? 'Atenção' : 'OK'
                }</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
                <DropdownMenuRadioItem value="all">Todos os Orçamentos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="over" className="text-red-500">Acima do Limite</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="warning" className="text-amber-500">Próximo ao Limite</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ok" className="text-emerald-500">Dentro do Limite</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1 min-w-[140px] max-w-[180px]">
            <MonthYearPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando orçamentos...</span>
          </div>
        </div>
      ) : filteredBudgets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
              🎯
            </div>
            <p className="text-muted-foreground">
              {budgets.length === 0
                ? "Nenhum orçamento para este período"
                : "Nenhum orçamento corresponde ao filtro selecionado"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {filteredBudgets.map((budget) => {
            const spent = Math.abs(budget.amount_actual || 0);
            const limit = Math.abs((budget.limit_cents || budget.amount_planned_cents || 0) / 100);
            const percentage = limit > 0 ? (spent / limit) * 100 : 0;
            const remaining = Math.max(0, limit - spent);
            const isOver = spent > limit;
            const isWarning = percentage >= 80 && percentage <= 100;
            const categoryName = budget.categories?.name || 'Sem categoria';
            const categoryIcon = budget.categories?.icon || '🎯';
            const categoryColor = budget.categories?.color || '#3b82f6';

            return (
              <div
                key={budget.id}
                className={cn(
                  "group relative p-3 md:p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-all duration-300",
                  isOver && "border-red-500/20 bg-red-500/[0.02] hover:bg-red-500/[0.04]",
                  isWarning && "border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/[0.04]"
                )}
                style={!isOver && !isWarning ? { borderLeft: `3px solid ${categoryColor}` } : undefined}
              >
                <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={cn(
                      "w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-sm md:text-lg shadow-sm transition-transform group-hover:scale-110 flex-shrink-0",
                      isOver ? "bg-red-500/10" : isWarning ? "bg-amber-500/10" : "bg-muted"
                    )}
                      style={!isOver && !isWarning ? { backgroundColor: `${categoryColor}15` } : undefined}
                    >
                      {categoryIcon}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <h3 className="font-semibold text-xs md:text-sm truncate">{categoryName}</h3>
                      <div className="flex items-center gap-1">
                        {isOver ? (
                          <div className="flex items-center gap-0.5 text-red-500">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span className="text-[9px] md:text-[10px] font-medium">Crítico</span>
                          </div>
                        ) : isWarning ? (
                          <div className="flex items-center gap-0.5 text-amber-500">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span className="text-[9px] md:text-[10px] font-medium">Atenção</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 text-emerald-500">
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                            <span className="text-[9px] md:text-[10px] font-medium">OK</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn(
                      "text-[10px] md:text-xs font-bold",
                      isOver ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-muted-foreground font-medium">Consumido</span>
                      <span className="font-bold">{formatCurrency(spent)}</span>
                    </div>
                    <Progress
                      value={Math.min(percentage, 100)}
                      className="h-1 md:h-1.5 transition-all"
                      indicatorClassName={cn(
                        "transition-all duration-500",
                        isOver ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                          isWarning ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                            ""
                      )}
                      style={!isOver && !isWarning ? { backgroundColor: categoryColor } : undefined}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1 md:gap-2 pt-1 border-t border-border/10">
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-semibold">Objetivo</span>
                      <span className="text-[10px] md:text-xs font-medium">{formatCurrency(limit)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase font-semibold">
                        {isOver ? "Excedente" : "Disponível"}
                      </span>
                      <span className={cn(
                        "text-[10px] md:text-xs font-bold",
                        isOver ? "text-red-500" : "text-emerald-500"
                      )}>
                        {formatCurrency(isOver ? spent - limit : remaining)}
                      </span>
                    </div>
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

