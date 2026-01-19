'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReplicateBudgetModal } from '@/components/budgets/ReplicateBudgetModal';
import { ReplicateAllBudgetsModal } from '@/components/budgets/ReplicateAllBudgetsModal';
import { ReplicateCategoryModal } from '@/components/budgets/ReplicateCategoryModal';
import { InlineBudgetEditor } from '@/components/budgets/InlineBudgetEditor';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { PlanGuard } from '@/components/app/PlanGuard';

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
  source_type?: 'general' | 'credit_card' | 'investment' | 'goal' | 'debt' | 'asset' | null;
}

interface Budget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount_planned_cents?: number;
  limit_cents?: number;
  amount_actual?: number;
  minimum_amount_planned_cents?: number;
  auto_contributions_cents?: number;
  categories?: Category;
  source_type?: 'manual' | 'credit_card' | 'goal' | 'debt' | 'installment' | 'investment';
  source_id?: string;
  is_projected?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [categoryMinimums, setCategoryMinimums] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [includeProjections, setIncludeProjections] = useState(false);
  const [replicateModalOpen, setReplicateModalOpen] = useState(false);
  const [selectedBudgetForReplicate, setSelectedBudgetForReplicate] = useState<Budget | null>(null);
  const [replicateAllModalOpen, setReplicateAllModalOpen] = useState(false);
  const [replicateCategoryModalOpen, setReplicateCategoryModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formData, setFormData] = useState({
    category_id: '',
    limit_cents: 0,
    month: selectedMonth,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'general' | 'credit_card' | 'investment' | 'goal' | 'debt'>('all');
  const [showMissingBudgetAlert, setShowMissingBudgetAlert] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { toast } = useToast();
  const missingAlertSessionKey = 'budgets_missing_alert_shown_session';

  // Scroll to top immediately when component mounts
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth, includeProjections]);

  // Check for missing budgets alert on mount and when budgets/categories change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!loading && categories.length > 0) {
      const dontShow = localStorage.getItem('budgets_dont_show_missing_alert') === 'true';
      const shownThisSession = sessionStorage.getItem(missingAlertSessionKey) === 'true';
      if (!dontShow) {
        if (!shownThisSession) {
          checkMissingBudgetsAlert();
          sessionStorage.setItem(missingAlertSessionKey, 'true');
        }
      }
    }
  }, [loading, budgets, categories, selectedMonth]);

  // Also scroll to top when loading finishes
  useEffect(() => {
    if (!loading) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
    }
  }, [loading]);

  // Fetch minimum amounts for categories without budget
  useEffect(() => {
    // Calculate categories without budget here
    const budgetsByCategoryId = new Map(budgets.map(b => [b.category_id, b]));
    const categoriesWithoutBudget = categories.filter(cat => !budgetsByCategoryId.has(cat.id));

    if (categoriesWithoutBudget.length > 0) {
      fetchCategoryMinimums(categoriesWithoutBudget);
    } else {
      setCategoryMinimums({});
    }
  }, [categories, budgets, selectedMonth]);

  const fetchCategoryMinimums = async (categoriesWithoutBudget: Category[]) => {
    const minimums: Record<string, number> = {};
    for (const category of categoriesWithoutBudget) {
      try {
        const res = await fetch(`/api/budgets/minimum?category_id=${category.id}&month=${selectedMonth}`);
        if (res.ok) {
          const data = await res.json();
          minimums[category.id] = data.data.minimum_amount || 0;
        }
      } catch (error) {
        console.error(`Error fetching minimum for category ${category.id}:`, error);
      }
    }
    setCategoryMinimums(minimums);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      // Include both income and expense categories
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      let url = `/api/budgets?month=${selectedMonth}`;
      if (includeProjections) {
        url += `&include_projections=true&start_month=${selectedMonth}&end_month=${selectedMonth}`;
      }
      const res = await fetch(url);
      const data = await res.json();

      if (includeProjections && data.data?.budgets) {
        setBudgets(data.data.budgets || []);
      } else {
        setBudgets(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReplicate = (budget: Budget) => {
    setSelectedBudgetForReplicate(budget);
    setReplicateModalOpen(true);
  };

  const handleCreateBudget = async (categoryId: string, value: number) => {
    const monthDate = `${selectedMonth}-01`;
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        month: monthDate,
        limit_cents: Math.round(value * 100),
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      const error = new Error(errorData.error || 'Erro ao criar orçamento');
      (error as any).minimum_amount = errorData.minimum_amount;
      (error as any).sources = errorData.sources;
      (error as any).suggestion = errorData.suggestion;
      throw error;
    }

    const result = await res.json();
    toast({
      title: 'Sucesso',
      description: 'Orçamento criado com sucesso',
    });
    // Refresh budgets to update the UI
    await fetchBudgets();
  };

  const handleCreateBudgetWithBreakdown = async (
    categoryId: string,
    items: { id?: string; label: string; amount_cents: number }[]
  ) => {
    const monthDate = `${selectedMonth}-01`;
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        month: monthDate,
        breakdown_items: items,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      const error = new Error(errorData.error || 'Erro ao criar orçamento');
      (error as any).minimum_amount = errorData.minimum_amount;
      (error as any).sources = errorData.sources;
      (error as any).suggestion = errorData.suggestion;
      throw error;
    }

    toast({
      title: 'Sucesso',
      description: 'Orçamento criado com sucesso',
    });
    await fetchBudgets();
  };

  const handleUpdateBudget = async (budgetId: string, value: number) => {
    const res = await fetch(`/api/budgets/${budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit_cents: Math.round(value * 100),
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      const error = new Error(errorData.error || 'Erro ao atualizar orçamento');
      (error as any).minimum_amount = errorData.minimum_amount;
      (error as any).sources = errorData.sources;
      (error as any).suggestion = errorData.suggestion;
      throw error;
    }

    await fetchBudgets();
    toast({
      title: 'Sucesso',
      description: 'Orçamento atualizado com sucesso',
    });
  };

  const handleUpdateBudgetWithBreakdown = async (
    budgetId: string,
    items: { id?: string; label: string; amount_cents: number }[],
    fallbackLimitReais: number
  ) => {
    const body: any = { breakdown_items: items };
    // If clearing breakdown, we must also provide a direct value to keep the budget valid
    if (items.length === 0) {
      body.limit_cents = Math.round(fallbackLimitReais * 100);
    }

    const res = await fetch(`/api/budgets/${budgetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      const error = new Error(errorData.error || 'Erro ao atualizar orçamento');
      (error as any).minimum_amount = errorData.minimum_amount;
      (error as any).sources = errorData.sources;
      (error as any).suggestion = errorData.suggestion;
      throw error;
    }

    await fetchBudgets();
    toast({
      title: 'Sucesso',
      description: 'Orçamento atualizado com sucesso',
    });
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) {
      return;
    }

    try {
      const res = await fetch(`/api/budgets/${budgetId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao excluir orçamento');
      }

      toast({
        title: 'Sucesso',
        description: 'Orçamento excluído com sucesso',
      });

      await fetchBudgets();
    } catch (error: any) {
      toast({
        title: 'Falha ao excluir orçamento',
        description: error.message || 'Não foi possível excluir o orçamento. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleReplicateAll = () => {
    if (manualBudgets.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há orçamentos manuais para replicar',
        variant: 'destructive',
      });
      return;
    }

    setReplicateAllModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const checkMissingBudgetsAlert = () => {
    // Check if user has chosen to not show this alert again
    if (typeof window === 'undefined') return;

    const dontShowKey = 'budgets_dont_show_missing_alert';
    if (localStorage.getItem(dontShowKey) === 'true') {
      return;
    }

    // Calculate manual budgets (needed for check)
    const allManualBudgets = budgets.filter(b => (!b.source_type || b.source_type === 'manual') && !b.is_projected);

    // Calculate categories without budget (only general categories)
    const budgetsByCategoryId = new Map(allManualBudgets.map(b => [b.category_id, b]));
    const generalCategoriesWithoutBudget = categories.filter(
      cat => (!cat.source_type || cat.source_type === 'general') && !budgetsByCategoryId.has(cat.id)
    );

    if (generalCategoriesWithoutBudget.length > 0) {
      setShowMissingBudgetAlert(true);
    }
  };

  const handleCloseMissingBudgetAlert = () => {
    setShowMissingBudgetAlert(false);

    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('budgets_dont_show_missing_alert', 'true');
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(missingAlertSessionKey, 'true');
    }

    setDontShowAgain(false);
  };

  // Separate budgets and categories by type (income/expense)
  const allManualBudgets = budgets.filter(b => (!b.source_type || b.source_type === 'manual') && !b.is_projected);

  // Filter budgets based on search term and source type
  const manualBudgets = allManualBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    if (!cat) return false;

    // Check search term
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.description || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Check source type filter
    const categorySource = cat.source_type || 'general';
    const matchesSource = filterSource === 'all' || categorySource === filterSource;

    return matchesSearch && matchesSource;
  });

  // Separate by income and expense (default to expense if type is not defined)
  const incomeBudgets = manualBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.type === 'income';
  });

  const expenseBudgets = manualBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return !cat?.type || cat.type === 'expense';
  });

  // Calculate totals separately for income and expense
    const incomePlanned = incomeBudgets.reduce(
      (sum, b) => sum + Math.abs((b.limit_cents || b.amount_planned_cents || 0) / 100),
      0
    );
  const incomeActual = incomeBudgets.reduce((sum, b) => sum + Math.abs(b.amount_actual || 0), 0);

    const expensePlanned = expenseBudgets.reduce(
      (sum, b) => sum + Math.abs((b.limit_cents || b.amount_planned_cents || 0) / 100),
      0
    );
  const expenseActual = expenseBudgets.reduce((sum, b) => sum + Math.abs(b.amount_actual || 0), 0);

  const budgetsByCategoryId = new Map(manualBudgets.map(b => [b.category_id, b]));

  // Filter categories
  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categorySource = cat.source_type || 'general';
    const matchesSource = filterSource === 'all' || categorySource === filterSource;
    return matchesSearch && matchesSource;
  });

  const categoriesWithoutBudget = filteredCategories.filter(cat => !budgetsByCategoryId.has(cat.id));

  // Separate categories by type (default to expense if type is not defined)
  const incomeCategories = categoriesWithoutBudget.filter(c => c.type === 'income');
  const expenseCategories = categoriesWithoutBudget.filter(c => !c.type || c.type === 'expense');

  // Projected budgets are shown separately
  const projectedBudgets = budgets.filter(b => b.is_projected || (b.source_type && b.source_type !== 'manual'));

  const gradientColors = [
    'from-orange-500 to-red-500',
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500',
  ];

  // Helper to get source type icon
  const getSourceTypeIcon = (sourceType?: string | null) => {
    switch (sourceType) {
      case 'credit_card': return '💳';
      case 'investment': return '📊';
      case 'goal': return '🎯';
      case 'debt': return '📋';
      case 'asset': return '🏠';
      default: return null;
    }
  };

  // Helper function to render budget card - COMPACT VERSION
  const renderBudgetCard = (budget: Budget, index: number) => {
    const spent = Math.abs(budget.amount_actual || 0);
    const limit = Math.abs((budget.limit_cents || budget.amount_planned_cents || 0) / 100);
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const isOver = spent > limit;
    const colorClass = gradientColors[index % gradientColors.length];
    const category = categories.find(c => c.id === budget.category_id);
    const isIncome = category?.type === 'income';
    const isReadOnly = ['credit_card', 'investment', 'goal', 'debt'].includes(category?.source_type || '') ||
      ['credit_card', 'goal', 'debt'].includes(budget.source_type || '');
    const sourceIcon = getSourceTypeIcon(category?.source_type);
    const breakdownCount = Array.isArray((budget.metadata as any)?.budget_breakdown?.items)
      ? (budget.metadata as any).budget_breakdown.items.length
      : 0;

    return (
      <div key={budget.id} className={`glass-card p-3 md:p-4 group hover:border-primary/30 transition-colors ${isReadOnly ? 'opacity-80' : ''}`}>
        {/* Header row - compact */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {sourceIcon && <span className="text-sm flex-shrink-0">{sourceIcon}</span>}
            <h3 className="font-medium text-sm md:text-base truncate">
              {budget.categories?.name || budget.description || 'Categoria'}
            </h3>
            {breakdownCount > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                <i className="bx bx-list-ul text-[10px]"></i>
                <span>{breakdownCount} subs</span>
              </span>
            )}
            {/* Auto-generated badge */}
            {isReadOnly && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5">
                <i className='bx bx-lock text-[10px]'></i>
                <span className="hidden sm:inline">Auto</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Only show action buttons for manual budgets */}
            {!isReadOnly && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReplicate(budget)}
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Replicar"
                >
                  <i className='bx bx-copy text-sm'></i>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteBudget(budget.id)}
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  title="Excluir"
                >
                  <i className='bx bx-trash text-sm'></i>
                </Button>
              </>
            )}
            {!isIncome && (
              <span className={`text-xs font-semibold min-w-[36px] text-right ${isOver ? 'text-red-500' : percentage >= 80 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {percentage.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Progress bar - thinner */}
        {!isIncome && (
          <div className="mb-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${isOver ? 'from-red-500 to-red-600' : percentage >= 80 ? 'from-yellow-500 to-orange-500' : colorClass} transition-all`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Values row - inline compact */}
        <div className="flex items-center justify-between text-xs md:text-sm gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{isIncome ? 'Rec:' : 'Gasto:'}</span>
            <span className={`font-medium ${isOver ? 'text-red-500' : ''}`}>{formatCurrency(spent)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground hidden sm:inline">{isIncome ? 'Plan:' : 'Limite:'}</span>
            <InlineBudgetEditor
              budgetId={budget.id}
              categoryId={budget.category_id}
              categoryName={budget.categories?.name || ''}
              currentValue={limit}
              minimumValue={(budget.minimum_amount_planned_cents || 0) / 100}
              month={selectedMonth}
              onSave={(value) => handleUpdateBudget(budget.id, value)}
              onSaveBreakdown={(items) => handleUpdateBudgetWithBreakdown(budget.id, items, limit)}
              mode="edit"
              isReadOnly={isReadOnly}
              metadata={(budget.metadata as any) || null}
            />
          </div>
        </div>

        {/* Over budget alert - compact inline */}
        {!isIncome && isOver && (
          <div className="mt-2 py-1.5 px-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-500 flex items-center gap-1">
              <i className='bx bx-error-circle'></i>
              <span>+{formatCurrency(spent - limit)} acima</span>
            </p>
          </div>
        )}

        {/* Minimum info - only on hover */}
        {(budget.minimum_amount_planned_cents ?? 0) > 0 && (
          <div className="mt-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Mín: {formatCurrency((budget.minimum_amount_planned_cents ?? 0) / 100)}
          </div>
        )}
      </div>
    );
  };

  // Helper function to render category card without budget - COMPACT ROW VERSION
  const renderCategoryCard = (category: Category) => {
    const sourceIcon = getSourceTypeIcon(category.source_type);
    const isReadOnly = ['credit_card', 'investment', 'goal', 'debt'].includes(category.source_type || '');
    
    // Get auto-generated label based on source type
    const getAutoLabel = () => {
      switch (category.source_type) {
        case 'credit_card': return 'Cartão de crédito';
        case 'investment': return 'Investimento';
        case 'goal': return 'Objetivo';
        case 'debt': return 'Dívida';
        default: return 'Automático';
      }
    };
    
    return (
      <div
        key={category.id}
        className={`glass-card p-2.5 md:p-3 border transition-colors ${
          isReadOnly 
            ? 'border-muted-foreground/10 bg-muted/20 opacity-60' 
            : 'border-dashed border-muted-foreground/20 hover:border-primary/40'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Category name with icon */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {sourceIcon && <span className="text-sm flex-shrink-0">{sourceIcon}</span>}
            <span className={`text-sm truncate ${isReadOnly ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
              {category.name}
            </span>
          </div>
          
          {/* Show auto badge or inline budget editor */}
          <div className="flex-shrink-0">
            {isReadOnly ? (
              <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-2 py-1 rounded flex items-center gap-1 border border-dashed border-border/30">
                <i className='bx bx-lock text-[10px]'></i>
                <span className="hidden sm:inline">{getAutoLabel()}</span>
                <span className="sm:hidden">Auto</span>
              </span>
            ) : (
              <div className="w-32 md:w-40">
                <InlineBudgetEditor
                  categoryId={category.id}
                  categoryName={category.name}
                  minimumValue={categoryMinimums[category.id] || 0}
                  month={selectedMonth}
                  onSave={(value) => handleCreateBudget(category.id, value)}
                  onSaveBreakdown={(items) => handleCreateBudgetWithBreakdown(category.id, items)}
                  mode="create"
                  isReadOnly={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <PlanGuard minPlan="pro">
      <div className="space-y-3 md:space-y-4 max-w-full overflow-x-hidden">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="font-display text-lg md:text-xl lg:text-2xl font-bold">Orçamentos</h1>
              <p className="text-muted-foreground text-xs md:text-sm">Limites e acompanhamento</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <MonthYearPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="Mês"
              className="w-auto min-w-[160px] md:min-w-[200px] text-sm"
            />
            <Button
              onClick={handleReplicateAll}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              disabled={manualBudgets.length === 0}
              title="Replicar todos os orçamentos"
            >
              <i className='bx bx-copy'></i>
              <span className="hidden md:inline ml-1">Todos</span>
            </Button>
            <Button
              onClick={() => setReplicateCategoryModalOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              title="Replicar categoria específica"
            >
              <i className='bx bx-target-lock'></i>
              <span className="hidden md:inline ml-1">Categoria</span>
            </Button>
          </div>
        </div>

        {/* Compact Filters + Summary Row */}
        <div className="glass-card p-2.5 md:p-3 max-w-full overflow-x-hidden">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 max-w-full">
            {/* Search */}
            <div className="relative flex-1 min-w-0 md:max-w-xs">
              <i className='bx bx-search absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'></i>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-muted/50 border border-border focus:border-primary focus:outline-none"
              />
            </div>
            
            {/* Filter pills - compact */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-shrink-0 max-w-full">
              {[
                { key: 'all', label: 'Todas' },
                { key: 'general', label: 'Gerais' },
                { key: 'credit_card', label: '💳' },
                { key: 'investment', label: '📊' },
                { key: 'goal', label: '🎯' },
                { key: 'debt', label: '📋' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterSource(key as typeof filterSource)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap ${
                    filterSource === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-6 bg-border flex-shrink-0" />

            {/* Summary inline - compact */}
            <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-[10px] sm:text-xs md:text-sm overflow-x-auto scrollbar-hide flex-shrink-0">
              <div className="flex items-center gap-1 flex-shrink-0">
                <i className='bx bx-trending-up text-green-500 text-xs md:text-sm'></i>
                <span className="text-muted-foreground hidden sm:inline">Receitas:</span>
                <span className="font-semibold text-green-500 whitespace-nowrap">{formatCurrency(incomeActual)}</span>
                <span className="text-muted-foreground whitespace-nowrap hidden md:inline">/ {formatCurrency(incomePlanned)}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <i className='bx bx-trending-down text-red-500 text-xs md:text-sm'></i>
                <span className="text-muted-foreground hidden sm:inline">Despesas:</span>
                <span className="font-semibold text-red-500 whitespace-nowrap">{formatCurrency(expenseActual)}</span>
                <span className="text-muted-foreground whitespace-nowrap hidden md:inline">/ {formatCurrency(expensePlanned)}</span>
              </div>
              <div className={`flex items-center gap-1 font-semibold flex-shrink-0 ${(expensePlanned - expenseActual) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                <span className="text-muted-foreground hidden sm:inline">Livre:</span>
                <span className="whitespace-nowrap">{formatCurrency(expensePlanned - expenseActual)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Income Budgets Section - SIMPLIFIED */}
        {incomeBudgets.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm md:text-lg font-semibold flex items-center gap-2">
                <i className='bx bx-trending-up text-green-500'></i>
                Orçamentos de Receita
              </h2>
              <span className="text-xs text-muted-foreground bg-green-500/20 px-2 py-0.5 rounded-full">
                {incomeBudgets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {incomeBudgets.map((budget, index) => renderBudgetCard(budget, index))}
            </div>
          </div>
        )}

        {/* Expense Budgets Section - SIMPLIFIED */}
        {expenseBudgets.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm md:text-lg font-semibold flex items-center gap-2">
                <i className='bx bx-trending-down text-red-500'></i>
                Orçamentos de Despesa
              </h2>
              <span className="text-xs text-muted-foreground bg-red-500/20 px-2 py-0.5 rounded-full">
                {expenseBudgets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {expenseBudgets.map((budget, index) => renderBudgetCard(budget, index))}
            </div>
          </div>
        )}

        {/* Projected Budgets - COMPACT */}
        {includeProjections && projectedBudgets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm md:text-lg font-semibold flex items-center gap-2">
                <i className='bx bx-time text-blue-500'></i>
                Projeções Automáticas
              </h2>
              <span className="text-xs text-muted-foreground bg-blue-500/20 px-2 py-0.5 rounded-full">
                {projectedBudgets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {projectedBudgets.map((budget, index) => {
                const spent = Math.abs(budget.amount_actual || 0);
                const limit = Math.abs((budget.limit_cents || budget.amount_planned_cents || 0) / 100);
                const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                const isOver = spent > limit;
                const colorClass = gradientColors[index % gradientColors.length];
                const sourceTypeLabels: Record<string, string> = {
                  credit_card: '💳',
                  goal: '🎯',
                  debt: '📋',
                  recurring: '🔄',
                  installment: '📅',
                  investment: '📊',
                };

                return (
                  <div key={budget.id} className="glass-card p-3 md:p-4 opacity-80 hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {budget.source_type && (
                          <span className="text-sm flex-shrink-0">{sourceTypeLabels[budget.source_type] || '📊'}</span>
                        )}
                        <h3 className="font-medium text-sm truncate">
                          {budget.categories?.name || budget.description || 'Categoria'}
                        </h3>
                      </div>
                      <span className={`text-xs font-semibold ${isOver ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full bg-gradient-to-r ${isOver ? 'from-red-500 to-red-600' : colorClass} transition-all`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(spent)}</span>
                      <span>{formatCurrency(limit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories Without Budget - COMPACT UNIFIED SECTION */}
        {(incomeCategories.length > 0 || expenseCategories.length > 0) && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm md:text-lg font-semibold flex items-center gap-2">
                  <i className='bx bx-plus-circle text-muted-foreground'></i>
                  Categorias sem Orçamento
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {incomeCategories.length + expenseCategories.length}
                </span>
              </div>
            </div>
            
            {/* Two column layout for income/expense */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Income Categories */}
              {incomeCategories.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-green-500 flex items-center gap-1.5 px-1">
                    <i className='bx bx-trending-up'></i>
                    Receitas ({incomeCategories.length})
                  </h3>
                  <div className="space-y-1.5">
                    {incomeCategories.map(renderCategoryCard)}
                  </div>
                </div>
              )}
              
              {/* Expense Categories */}
              {expenseCategories.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-red-500 flex items-center gap-1.5 px-1">
                    <i className='bx bx-trending-down'></i>
                    Despesas ({expenseCategories.length})
                  </h3>
                  <div className="space-y-1.5">
                    {expenseCategories.map(renderCategoryCard)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {incomeBudgets.length === 0 && expenseBudgets.length === 0 && incomeCategories.length === 0 && expenseCategories.length === 0 && (
          <div className="glass-card p-12 text-center">
            <i className='bx bx-target-lock text-4xl text-muted-foreground mb-4'></i>
            <h3 className="font-display font-semibold mb-2">Nenhuma categoria encontrada</h3>
            <p className="text-muted-foreground mb-6">
              Crie categorias de receita ou despesa para começar a definir orçamentos
            </p>
          </div>
        )}

        {/* Create Budget Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Orcamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Categoria</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories
                    .filter(cat => !['credit_card', 'investment', 'goal', 'debt'].includes(cat.source_type || ''))
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Limite (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.limit_cents / 100}
                  onChange={(e) => setFormData({ ...formData, limit_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  className="flex-1"
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!formData.category_id || formData.limit_cents <= 0) {
                      toast({
                        title: 'Campos incompletos',
                        description: 'Por favor, preencha todos os campos obrigatórios',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setSaving(true);
                    try {
                      await handleCreateBudget(formData.category_id, formData.limit_cents / 100);
                      setFormOpen(false);
                      setFormData({ category_id: '', limit_cents: 0, month: selectedMonth });
                    } catch (error: any) {
                      // Error already handled in handleCreateBudget
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || !formData.category_id || formData.limit_cents <= 0}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Salvando...' : 'Criar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Replicate Budget Modal */}
        {selectedBudgetForReplicate && (
          <ReplicateBudgetModal
            open={replicateModalOpen}
            onOpenChange={setReplicateModalOpen}
            budgetId={selectedBudgetForReplicate.id}
            budgetName={selectedBudgetForReplicate.categories?.name || 'Orçamento'}
            onSuccess={fetchBudgets}
          />
        )}

        {/* Replicate All Budgets Modal */}
        <ReplicateAllBudgetsModal
          open={replicateAllModalOpen}
          onOpenChange={setReplicateAllModalOpen}
          currentMonth={selectedMonth}
          budgetCount={manualBudgets.length}
          onSuccess={fetchBudgets}
        />

        {/* Replicate Category Modal */}
        <ReplicateCategoryModal
          open={replicateCategoryModalOpen}
          onOpenChange={setReplicateCategoryModalOpen}
          currentMonth={selectedMonth}
          categories={categories.filter(
            cat => !cat.source_type || cat.source_type === 'general'
          )}
          onSuccess={fetchBudgets}
        />

        {/* Missing Budgets Alert */}
        <AlertDialog
          open={showMissingBudgetAlert}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseMissingBudgetAlert();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <i className='bx bx-info-circle text-yellow-500'></i>
                Categorias sem Orçamento
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-2">
                {(() => {
                  const allManualBudgetsForAlert = budgets.filter(b => (!b.source_type || b.source_type === 'manual') && !b.is_projected);
                  const budgetsByCategoryId = new Map(allManualBudgetsForAlert.map(b => [b.category_id, b]));
                  const generalCategoriesWithoutBudget = categories.filter(
                    cat => (!cat.source_type || cat.source_type === 'general') && !budgetsByCategoryId.has(cat.id)
                  );
                  const count = generalCategoriesWithoutBudget.length;
                  const categoryNames = generalCategoriesWithoutBudget
                    .slice(0, 5)
                    .map(cat => cat.name)
                    .join(', ');
                  const more = count > 5 ? ` e mais ${count - 5} categorias` : '';

                  return (
                    <div className="space-y-2">
                      <p>
                        Existem <strong>{count}</strong> categorias sem orçamento definido para o mês de <strong>{getMonthLabel(selectedMonth)}</strong>.
                      </p>
                      {count > 0 && (
                        <div className="bg-muted/50 p-3 rounded-lg mt-3">
                          <p className="text-sm font-medium mb-1">Categorias sem orçamento:</p>
                          <p className="text-sm text-muted-foreground">
                            {categoryNames}{more}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Defina orçamentos para melhor controle financeiro e acompanhamento dos gastos.
                      </p>
                    </div>
                  );
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto order-2 sm:order-1">
                <Checkbox
                  id="dontShowAgain"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <label htmlFor="dontShowAgain" className="text-sm cursor-pointer text-muted-foreground">
                  Não mostrar novamente
                </label>
              </div>
              <AlertDialogAction onClick={handleCloseMissingBudgetAlert} className="w-full sm:w-auto order-1 sm:order-2">
                Entendi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PlanGuard>
  );
}
