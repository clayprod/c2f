'use client';

import { useState, useEffect, useMemo } from 'react';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { Progress } from '@/components/ui/progress';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { cn, formatCurrencyValue, calculateDailySpendingEstimates } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Filter,
  TrendingUp,
  Calendar,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

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
  source_type?: 'manual' | 'credit_card' | 'goal' | 'debt' | 'installment' | 'investment' | 'receivable';
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
  const isMobile = useIsMobile();

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

  // Alias para manter compatibilidade
  const formatCurrency = formatCurrencyValue;

  const filteredBudgets = useMemo(() => {
    return budgets.filter(budget => {
      // Filter out income categories - only show expense budgets
      // Income categories (like "Rendimento - Conta") don't make sense in this expense tracking view
      const categoryType = budget.categories?.type;
      if (categoryType === 'income') return false;

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
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <div className="glass-card p-3 md:p-4 lg:p-6 max-w-full">
        <div className="flex flex-col gap-2 md:gap-3 mb-3 md:mb-4 lg:mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display font-semibold text-sm md:text-sm lg:text-lg">Orçamentos por Categoria</h2>
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold text-primary">Sobre esta seção:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside text-muted-foreground">
                    <li>Mostra os orçamentos para o mês selecionado.</li>
                    <li>A barra de progresso indica o consumo em relação ao limite.</li>
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive" /> Acima do limite (&gt;100%)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Próximo ao limite (80-100%)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" /> Dentro do limite (&lt;80%)
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
              <Button variant="outline" size="sm" className="h-7 md:h-8 lg:h-9 gap-1 text-xs md:text-xs lg:text-sm">
                <Filter className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
                <span className="hidden md:inline">Status: </span>
                <span>{
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
                <DropdownMenuRadioItem value="over" className="text-destructive">Acima do Limite</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="warning" className="text-warning">Próximo ao Limite</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ok" className="text-success">Dentro do Limite</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1 min-w-[120px] md:min-w-[140px] max-w-[160px] md:max-w-[180px]">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-2 md:gap-3 lg:gap-4 max-w-full overflow-visible animate-children-stagger">
          {filteredBudgets.map((budget, index) => {
            const spent = Math.abs(budget.amount_actual || 0);
            const limit = Math.abs((budget.limit_cents || budget.amount_planned_cents || 0) / 100);
            const percentage = limit > 0 ? (spent / limit) * 100 : 0;
            const remaining = Math.max(0, limit - spent);
            const isOver = spent > limit;
            const isWarning = percentage >= 80 && percentage <= 100;
            const categoryName = budget.categories?.name || 'Sem categoria';
            const categoryIcon = budget.categories?.icon || '🎯';
            const categoryColor = budget.categories?.color || '#3b82f6';
            
            // Identify if budget is automatic (same logic as budgets page)
            const autoSourceTypes = ['credit_card', 'investment', 'goal', 'debt', 'receivable'];
            const categorySourceType = (budget.categories as any)?.source_type;
            const isAutomatic = autoSourceTypes.includes(categorySourceType || '') ||
              autoSourceTypes.includes(budget.source_type || '') ||
              budget.is_projected === true;

            // Calcular estimativas diárias (apenas para mês atual)
            const estimates = calculateDailySpendingEstimates(spent, limit, budget.year, budget.month);
            const showEstimates = estimates !== null;

            const budgetCard = (
              <div
                className={cn(
                  "group relative p-2.5 md:p-3 lg:p-4 rounded-xl border border-border bg-card/30",
                  "hover:bg-card/50 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer",
                  isOver && "border-destructive/30 bg-destructive/[0.02] hover:bg-destructive/[0.04] hover:border-destructive/40",
                  isWarning && "border-amber-500/30 bg-amber-500/[0.02] hover:bg-amber-500/[0.04] hover:border-amber-500/40",
                  showEstimates && !isMobile && !isAutomatic && "hover:ring-2 hover:ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between mb-2 md:mb-3 lg:mb-4 gap-1.5 md:gap-2">
                  <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
                    <div className={cn(
                      "w-7 h-7 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center text-sm md:text-sm lg:text-lg shadow-sm transition-transform group-hover:scale-110 flex-shrink-0",
                      isOver ? "bg-destructive/10" : isWarning ? "bg-warning/10" : "bg-muted"
                    )}
                      style={!isOver && !isWarning ? { backgroundColor: `${categoryColor}15` } : undefined}
                    >
                      {categoryIcon}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                      <h3 className="font-semibold text-xs md:text-xs lg:text-sm leading-tight line-clamp-2" title={categoryName}>{categoryName}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isOver ? (
                          <div className="flex items-center gap-0.5 text-destructive">
                            <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
                            <span className="text-[8px] md:text-[9px] lg:text-[10px] font-medium">Crítico</span>
                          </div>
                        ) : isWarning ? (
                          <div className="flex items-center gap-0.5 text-amber-500">
                            <AlertTriangle className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
                            <span className="text-[8px] md:text-[9px] lg:text-[10px] font-medium">Atenção</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 text-success">
                            <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
                            <span className="text-[8px] md:text-[9px] lg:text-[10px] font-medium">OK</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn(
                      "text-xs md:text-[11px] lg:text-xs font-bold",
                      isOver ? "text-destructive" : isWarning ? "text-warning" : "text-success"
                    )}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 lg:space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] md:text-[10px] lg:text-xs">
                      <span className="text-muted-foreground font-medium">Consumido</span>
                      <span className="font-bold text-xs">{formatCurrency(spent)}</span>
                    </div>
                    <Progress
                      value={Math.min(percentage, 100)}
                      className="h-1.5 md:h-1 lg:h-1.5 transition-all"
                      indicatorClassName={cn(
                        "transition-all duration-500",
                        isOver ? "bg-destructive shadow-[0_0_8px_hsl(0_99%_64%_/_0.4)]" :
                          isWarning ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                            ""
                      )}
                      style={!isOver && !isWarning ? { backgroundColor: categoryColor } : undefined}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1 md:gap-1.5 lg:gap-2 pt-1 border-t border-border/10">
                    <div className="flex flex-col">
                      <span className="text-[8px] md:text-[9px] lg:text-[10px] text-muted-foreground uppercase font-semibold">
                        {isAutomatic ? "Pendente" : "Objetivo"}
                      </span>
                      <span className="text-[10px] md:text-[10px] lg:text-xs font-medium">{formatCurrency(limit)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] md:text-[9px] lg:text-[10px] text-muted-foreground uppercase font-semibold">
                        {isOver ? "Excedente" : (isAutomatic ? "A pagar" : "Disponível")}
                      </span>
                      <span className={cn(
                        "text-[10px] md:text-[10px] lg:text-xs font-bold",
                        isOver ? "text-destructive" : "text-success"
                      )}>
                        {formatCurrency(isOver ? spent - limit : remaining)}
                      </span>
                    </div>
                  </div>

                  {/* Estimativas diárias - sempre visível no mobile (apenas para categorias não automáticas) */}
                  {showEstimates && isMobile && !isAutomatic && (
                    <div className="pt-1.5 mt-1.5 border-t border-border/10">
                      <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>Média: {formatCurrency(estimates!.averageDailySpent)}/dia</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {estimates!.daysRemaining > 0 
                              ? `Restante: ${formatCurrency(estimates!.estimatedDailyRemaining)}/dia (${estimates!.daysRemaining} dias)`
                              : 'Fim do mês'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );

            // Envolver com Tooltip apenas no desktop, se houver estimativas e não for categoria automática
            if (showEstimates && !isMobile && !isAutomatic) {
              return (
                <Tooltip key={budget.id} delayDuration={300}>
                  <TooltipTrigger asChild>
                    {budgetCard}
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    sideOffset={16}
                    className={cn(
                      "max-w-[320px] bg-gradient-to-br from-popover to-popover/95",
                      "border-2 shadow-2xl backdrop-blur-sm",
                      "px-4 py-3",
                      isOver && "border-destructive/30 shadow-destructive/20",
                      isWarning && "border-warning/30 shadow-warning/20",
                      !isOver && !isWarning && "border-primary/30 shadow-primary/20"
                    )}
                    style={{ zIndex: 999999 }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <div className={cn(
                          "p-1.5 rounded-md",
                          isOver ? "bg-destructive/20 text-destructive" :
                          isWarning ? "bg-amber-500/20 text-amber-500" :
                          "bg-primary/20 text-primary"
                        )}>
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <span>Estimativas Diárias</span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-muted-foreground font-medium">Média diária até agora:</span>
                            <span className="font-bold text-foreground text-right">
                              {formatCurrency(estimates!.averageDailySpent)}/dia
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground pl-1">
                            ({estimates!.daysElapsed} {estimates!.daysElapsed === 1 ? 'dia' : 'dias'} decorridos)
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-muted-foreground font-medium">Estimativa até o fim:</span>
                            <span className={cn(
                              "font-bold text-right",
                              estimates!.estimatedDailyRemaining > estimates!.averageDailySpent * 1.2 
                                ? "text-amber-500" 
                                : estimates!.estimatedDailyRemaining < estimates!.averageDailySpent * 0.8
                                ? "text-success"
                                : "text-foreground"
                            )}>
                              {estimates!.daysRemaining > 0 
                                ? `${formatCurrency(estimates!.estimatedDailyRemaining)}/dia`
                                : 'Fim do mês'
                              }
                            </span>
                          </div>
                          {estimates!.daysRemaining > 0 && (
                            <div className="text-[10px] text-muted-foreground pl-1">
                              ({estimates!.daysRemaining} {estimates!.daysRemaining === 1 ? 'dia' : 'dias'} restantes)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            // Sem tooltip no mobile ou quando não há estimativas
            return <div key={budget.id}>{budgetCard}</div>;
          })}
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}

