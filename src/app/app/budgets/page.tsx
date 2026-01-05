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
  amount_planned: number;
  amount_actual?: number;
  minimum_amount_planned?: number;
  auto_contributions_cents?: number;
  categories?: Category;
  source_type?: 'manual' | 'credit_card' | 'goal' | 'debt' | 'recurring' | 'installment';
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
      if (!dontShow) {
        checkMissingBudgetsAlert();
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
  const incomePlanned = incomeBudgets.reduce((sum, b) => sum + Math.abs(b.amount_planned || 0), 0);
  const incomeActual = incomeBudgets.reduce((sum, b) => sum + Math.abs(b.amount_actual || 0), 0);
  
  const expensePlanned = expenseBudgets.reduce((sum, b) => sum + Math.abs(b.amount_planned || 0), 0);
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
  
  // Group income categories by source_type
  const incomeGeneralCategories = incomeCategories.filter(c => !c.source_type || c.source_type === 'general');
  const incomeCreditCardCategories = incomeCategories.filter(c => c.source_type === 'credit_card');
  const incomeInvestmentCategories = incomeCategories.filter(c => c.source_type === 'investment');
  const incomeGoalCategories = incomeCategories.filter(c => c.source_type === 'goal');
  const incomeDebtCategories = incomeCategories.filter(c => c.source_type === 'debt');
  const incomeAssetCategories = incomeCategories.filter(c => c.source_type === 'asset');
  
  // Group expense categories by source_type
  const expenseGeneralCategories = expenseCategories.filter(c => !c.source_type || c.source_type === 'general');
  const expenseCreditCardCategories = expenseCategories.filter(c => c.source_type === 'credit_card');
  const expenseInvestmentCategories = expenseCategories.filter(c => c.source_type === 'investment');
  const expenseGoalCategories = expenseCategories.filter(c => c.source_type === 'goal');
  const expenseDebtCategories = expenseCategories.filter(c => c.source_type === 'debt');
  const expenseAssetCategories = expenseCategories.filter(c => c.source_type === 'asset');
  
  // Group income budgets by source_type
  const incomeGeneralBudgets = incomeBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return !cat?.source_type || cat.source_type === 'general';
  });
  const incomeCreditCardBudgets = incomeBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'credit_card';
  });
  const incomeInvestmentBudgets = incomeBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'investment';
  });
  const incomeGoalBudgets = incomeBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'goal';
  });
  const incomeDebtBudgets = incomeBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'debt';
  });
  const incomeAssetBudgets = incomeBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'asset';
  });
  
  // Group expense budgets by source_type
  const expenseGeneralBudgets = expenseBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return !cat?.source_type || cat.source_type === 'general';
  });
  const expenseCreditCardBudgets = expenseBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'credit_card';
  });
  const expenseInvestmentBudgets = expenseBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'investment';
  });
  const expenseGoalBudgets = expenseBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'goal';
  });
  const expenseDebtBudgets = expenseBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'debt';
  });
  const expenseAssetBudgets = expenseBudgets.filter(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat?.source_type === 'asset';
  });

  const gradientColors = [
    'from-orange-500 to-red-500',
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500',
  ];

  // Helper function to render budget card
  const renderBudgetCard = (budget: Budget, index: number) => {
    const spent = Math.abs(budget.amount_actual || 0);
    const limit = Math.abs(budget.amount_planned || 0);
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const isOver = spent > limit;
    const colorClass = gradientColors[index % gradientColors.length];
    const category = categories.find(c => c.id === budget.category_id);
    const isIncome = category?.type === 'income';

    return (
      <div key={budget.id} className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-display font-semibold text-lg">
              {budget.categories?.name || budget.description || 'Categoria'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReplicate(budget)}
              className="text-xs"
              title="Replicar orçamento"
            >
              <i className='bx bx-copy'></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteBudget(budget.id)}
              className="text-xs text-destructive hover:text-destructive"
              title="Excluir orçamento"
            >
              <i className='bx bx-trash'></i>
            </Button>
            {!isIncome && (
              <span className={`text-sm font-medium ${isOver ? 'text-red-500' : 'text-muted-foreground'}`}>
                {percentage.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {!isIncome && (
          <div className="mb-4">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${isOver ? 'from-red-500 to-red-600' : colorClass} transition-all`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">{isIncome ? 'Recebido: ' : 'Gasto: '}</span>
              <span className="font-medium">{formatCurrency(spent)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{isIncome ? 'Planejado: ' : 'Limite: '}</span>
              <InlineBudgetEditor
                budgetId={budget.id}
                categoryId={budget.category_id}
                categoryName={budget.categories?.name || ''}
                currentValue={limit}
                minimumValue={budget.minimum_amount_planned || 0}
                month={selectedMonth}
                onSave={(value) => handleUpdateBudget(budget.id, value)}
                mode="edit"
              />
            </div>
            {budget.minimum_amount_planned && budget.minimum_amount_planned > 0 && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <i className='bx bx-info-circle'></i>
                <span>Mínimo: {formatCurrency(budget.minimum_amount_planned)} (contribuições automáticas)</span>
              </div>
            )}
          </div>
        </div>

        {!isIncome && isOver && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-500">
              <i className='bx bx-error-circle'></i> Você ultrapassou o limite em {formatCurrency(spent - limit)}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Helper function to render category card without budget
  const renderCategoryCard = (category: Category) => (
    <div 
      key={category.id} 
      className="glass-card p-6 border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-display font-semibold text-lg text-muted-foreground">
            {category.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <i className='bx bx-info-circle'></i>
            Sem orçamento definido
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center">
          <i className='bx bx-plus text-muted-foreground'></i>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Definir limite:</label>
          <InlineBudgetEditor
            categoryId={category.id}
            categoryName={category.name}
            minimumValue={categoryMinimums[category.id] || 0}
            month={selectedMonth}
            onSave={(value) => handleCreateBudget(category.id, value)}
            mode="create"
          />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">Defina limites e acompanhe seus gastos</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleReplicateAll} 
              variant="outline"
              className="btn-secondary"
              disabled={manualBudgets.length === 0}
            >
              <i className='bx bx-copy'></i>
              Replicar Todos
            </Button>
            <Button 
              onClick={() => setReplicateCategoryModalOpen(true)} 
              variant="outline"
              className="btn-secondary"
            >
              <i className='bx bx-target-lock'></i>
              Replicar Categoria Específica
            </Button>
          </div>
        </div>
        <div className="flex items-center">
          <MonthYearPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
            placeholder="Selecione o mês"
            className="min-w-[280px] text-base"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <input
              type="text"
              placeholder="Buscar categorias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterSource('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterSource === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterSource('general')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterSource === 'general'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Gerais
            </button>
            <button
              onClick={() => setFilterSource('credit_card')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterSource === 'credit_card'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              💳 Cartões
            </button>
            <button
              onClick={() => setFilterSource('investment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterSource === 'investment'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              📊 Investimentos
            </button>
            <button
              onClick={() => setFilterSource('goal')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterSource === 'goal'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              🎯 Objetivos
            </button>
            <button
              onClick={() => setFilterSource('debt')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterSource === 'debt'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              💳 Dívidas
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Separated by Income and Expense */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Summary */}
        <div className="glass-card p-5">
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <i className='bx bx-trending-up text-green-500'></i>
            Receitas
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Planejado</span>
              <p className="font-display text-xl font-bold text-green-500">{formatCurrency(incomePlanned)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Realizado</span>
              <p className="font-display text-xl font-bold">{formatCurrency(incomeActual)}</p>
            </div>
          </div>
        </div>

        {/* Expense Summary */}
        <div className="glass-card p-5">
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <i className='bx bx-trending-down text-red-500'></i>
            Despesas
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Orçado</span>
              <p className="font-display text-xl font-bold">{formatCurrency(expensePlanned)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Gasto</span>
              <p className="font-display text-xl font-bold text-red-500">{formatCurrency(expenseActual)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Disponível</span>
              <p className={`font-display text-xl font-bold ${
                (expensePlanned - expenseActual) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {formatCurrency(expensePlanned - expenseActual)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Income Budgets Section */}
      {incomeBudgets.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <i className='bx bx-trending-up text-green-500'></i>
              Orçamentos de Receita
            </h2>
            <span className="text-sm text-muted-foreground bg-green-500/20 px-2 py-0.5 rounded-full">
              {incomeBudgets.length}
            </span>
          </div>
          
          {/* Income General Budgets */}
          {incomeGeneralBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📁</span>
                Categorias Gerais ({incomeGeneralBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeGeneralBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Income Investment Budgets */}
          {incomeInvestmentBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📊</span>
                Investimentos ({incomeInvestmentBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeInvestmentBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Income Goal Budgets */}
          {incomeGoalBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🎯</span>
                Objetivos ({incomeGoalBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeGoalBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Income Debt Budgets */}
          {incomeDebtBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>💳</span>
                Dívidas ({incomeDebtBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeDebtBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Income Asset Budgets */}
          {incomeAssetBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🏠</span>
                Patrimônio ({incomeAssetBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeAssetBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense Budgets Section */}
      {expenseBudgets.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <i className='bx bx-trending-down text-red-500'></i>
              Orçamentos de Despesa
            </h2>
            <span className="text-sm text-muted-foreground bg-red-500/20 px-2 py-0.5 rounded-full">
              {expenseBudgets.length}
            </span>
          </div>
          
          {/* Expense General Budgets */}
          {expenseGeneralBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📁</span>
                Categorias Gerais ({expenseGeneralBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseGeneralBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Expense Credit Card Budgets */}
          {expenseCreditCardBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>💳</span>
                Cartões de Crédito ({expenseCreditCardBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseCreditCardBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Expense Investment Budgets */}
          {expenseInvestmentBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📊</span>
                Investimentos ({expenseInvestmentBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseInvestmentBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Expense Goal Budgets */}
          {expenseGoalBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🎯</span>
                Objetivos ({expenseGoalBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseGoalBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Expense Debt Budgets */}
          {expenseDebtBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>💳</span>
                Dívidas ({expenseDebtBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseDebtBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
          
          {/* Expense Asset Budgets */}
          {expenseAssetBudgets.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🏠</span>
                Patrimônio ({expenseAssetBudgets.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseAssetBudgets.map((budget, index) => renderBudgetCard(budget, index))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projected Budgets */}
      {includeProjections && projectedBudgets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold">Projeções Automáticas</h2>
            <span className="text-sm text-muted-foreground">({projectedBudgets.length})</span>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {projectedBudgets.map((budget, index) => {
              const spent = Math.abs(budget.amount_actual || 0);
              const limit = Math.abs(budget.amount_planned || 0);
              const percentage = limit > 0 ? (spent / limit) * 100 : 0;
              const isOver = spent > limit;
              const colorClass = gradientColors[index % gradientColors.length];
              const sourceTypeLabels: Record<string, string> = {
                credit_card: 'Fatura de Cartão',
                goal: 'Objetivo',
                debt: 'Dívida',
                recurring: 'Recorrente',
                installment: 'Parcela',
              };

              return (
                <div key={budget.id} className="glass-card p-6 opacity-75">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-lg">
                        {budget.categories?.name || budget.description || 'Categoria'}
                      </h3>
                      {budget.source_type && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📊 {sourceTypeLabels[budget.source_type] || budget.source_type}
                        </p>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${isOver ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${isOver ? 'from-red-500 to-red-600' : colorClass} transition-all`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">Gasto: </span>
                      <span className="font-medium">{formatCurrency(spent)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Limite: </span>
                      <span className="font-medium">{formatCurrency(limit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Income Categories Without Budget */}
      {incomeCategories.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <i className='bx bx-trending-up text-green-500'></i>
              Categorias de Receita sem Orçamento
            </h2>
            <span className="text-sm text-muted-foreground bg-green-500/20 px-2 py-0.5 rounded-full">
              {incomeCategories.length}
            </span>
          </div>
          
          {/* Income General Categories */}
          {incomeGeneralCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📁</span>
                Categorias Gerais ({incomeGeneralCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeGeneralCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Income Investment Categories */}
          {incomeInvestmentCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📊</span>
                Investimentos ({incomeInvestmentCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeInvestmentCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Income Goal Categories */}
          {incomeGoalCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🎯</span>
                Objetivos ({incomeGoalCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeGoalCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Income Debt Categories */}
          {incomeDebtCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>💳</span>
                Dívidas ({incomeDebtCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeDebtCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Income Asset Categories */}
          {incomeAssetCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🏠</span>
                Patrimônio ({incomeAssetCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {incomeAssetCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense Categories Without Budget */}
      {expenseCategories.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <i className='bx bx-trending-down text-red-500'></i>
              Categorias de Despesa sem Orçamento
            </h2>
            <span className="text-sm text-muted-foreground bg-red-500/20 px-2 py-0.5 rounded-full">
              {expenseCategories.length}
            </span>
          </div>
          
          {/* Expense General Categories */}
          {expenseGeneralCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📁</span>
                Categorias Gerais ({expenseGeneralCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseGeneralCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Expense Credit Card Categories */}
          {expenseCreditCardCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>💳</span>
                Cartões de Crédito ({expenseCreditCardCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseCreditCardCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Expense Investment Categories */}
          {expenseInvestmentCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📊</span>
                Investimentos ({expenseInvestmentCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseInvestmentCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Expense Goal Categories */}
          {expenseGoalCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🎯</span>
                Objetivos ({expenseGoalCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseGoalCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Expense Debt Categories */}
          {expenseDebtCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>💳</span>
                Dívidas ({expenseDebtCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseDebtCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          
          {/* Expense Asset Categories */}
          {expenseAssetCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>🏠</span>
                Patrimônio ({expenseAssetCategories.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {expenseAssetCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
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
                {categories.map((cat) => (
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
  );
}
