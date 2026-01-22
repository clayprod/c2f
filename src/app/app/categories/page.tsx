'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { CategoryMigrationModal } from '@/components/categories/CategoryMigrationModal';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  source_type?: 'general' | 'credit_card' | 'investment' | 'goal' | 'debt' | null;
  is_active?: boolean;
  transaction_count?: number;
}

const categoryColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#a855f7', '#f43f5e', '#14b8a6', '#64748b',
];

const categoryIcons = [
  '🏠', '🚗', '🍕', '🛒', '💊', '📚', '🎬', '✈️', '💇', '🏥',
  '💼', '🎁', '📱', '⚡', '💧', '🔥', '🎯', '💰', '💳', '📈',
  '🏦', '💎', '🎨', '🎭', '🎪', '🏆', '⭐', '🌟', '💫', '🔐',
  '🛠️', '📊', '📋', '✂️', '🧹', '🍽️', '☕', '🍺', '🎮', '🎸',
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'general' | 'credit_card' | 'investment' | 'goal' | 'debt'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [categoryToMigrate, setCategoryToMigrate] = useState<Category | null>(null);
  const [categoriesWithTransactions, setCategoriesWithTransactions] = useState<Map<string, number>>(new Map());
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    icon: '📁',
    color: '#3b82f6',
  });
  const { toast } = useToast();

  // Reset scroll imediatamente no mount e quando loading terminar
  useEffect(() => {
    const resetScroll = () => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    };

    // Reset imediato
    resetScroll();

    // Reset após pequeno delay para pegar qualquer scroll restoration do navegador
    const timer = setTimeout(resetScroll, 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset scroll adicional quando o loading terminar
  useEffect(() => {
    if (!loading) {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    }
  }, [loading]);

  useEffect(() => {
    fetchCategories();
    fetchCategoriesWithTransactions();
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [showInactive]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const url = showInactive
        ? '/api/categories?include_inactive=true'
        : '/api/categories';
      const res = await fetch(url);
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Falha ao carregar categorias',
        description: 'Não foi possível carregar as categorias. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesWithTransactions = async () => {
    try {
      const res = await fetch('/api/categories/with-transactions');
      const data = await res.json();
      const countMap = new Map<string, number>();
      (data.data || []).forEach((cat: Category) => {
        if (cat.transaction_count) {
          countMap.set(cat.id, cat.transaction_count);
        }
      });
      setCategoriesWithTransactions(countMap);
    } catch (error) {
      console.error('Error fetching categories with transactions:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Prevent editing non-general categories
    if (editingCategory) {
      const isGeneralCategory = !editingCategory.source_type || editingCategory.source_type === 'general';
      if (!isGeneralCategory) {
        toast({
          title: 'Erro',
          description: 'Categorias automáticas (cartões, objetivos, dívidas, investimentos e patrimônio) não podem ser editadas manualmente.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          type: formData.type,
          icon: formData.icon,
          color: formData.color,
          source_type: 'general', // Categorias criadas manualmente são sempre 'general'
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao salvar categoria');
      }

      toast({
        title: 'Sucesso',
        description: editingCategory ? 'Categoria atualizada' : 'Categoria criada',
      });

      fetchCategories();
      closeDialog();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    // Check if category has transactions
    const transactionCount = categoriesWithTransactions.get(categoryToDelete.id) || 0;
    if (transactionCount > 0) {
      toast({
        title: 'Erro',
        description: 'Não é possível excluir uma categoria que possui transações. Use a migração para transferir as transações primeiro.',
        variant: 'destructive',
      });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      return;
    }

    try {
      const res = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao excluir categoria');
      }

      toast({
        title: 'Sucesso',
        description: 'Categoria excluída',
      });

      fetchCategories();
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      icon: category.icon || '📁',
      color: category.color || '#3b82f6',
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      type: 'expense',
      icon: '📁',
      color: '#3b82f6',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleToggleActive = async (category: Category) => {
    // Only allow toggle for general categories
    const isGeneralCategory = !category.source_type || category.source_type === 'general';
    if (!isGeneralCategory) {
      toast({
        title: 'Erro',
        description: 'Categorias automáticas (cartões, objetivos, dívidas, investimentos e patrimônio) não podem ser ativadas ou inativadas manualmente.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !category.is_active }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao atualizar categoria');
      }

      toast({
        title: 'Sucesso',
        description: category.is_active
          ? 'Categoria inativada'
          : 'Categoria ativada',
      });

      fetchCategories();
      fetchCategoriesWithTransactions();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleOpenMigration = (category: Category) => {
    setCategoryToMigrate(category);
    setMigrationModalOpen(true);
  };

  const handleMigrationSuccess = () => {
    fetchCategories();
    fetchCategoriesWithTransactions();
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || category.type === filterType;
    // Match source: 'all' shows everything, otherwise match exact source_type or treat null as 'general'
    const categorySource = category.source_type || 'general';
    const matchesSource = filterSource === 'all' || categorySource === filterSource;
    // Filter inactive: if showInactive is false, only show active categories
    // If showInactive is true, show all categories (including inactive ones)
    // API already filters when include_inactive=false, returning only is_active=true or is_active=null
    // So when showInactive=false, all returned categories should be active
    // When showInactive=true, we get all categories and need to filter
    const matchesActive = showInactive
      ? true  // Show all when showInactive is true
      : (category.is_active === true || category.is_active === null || category.is_active === undefined); // Show only active when false
    return matchesSearch && matchesType && matchesSource && matchesActive;
  });

  // Group by source_type and type
  const generalIncome = filteredCategories.filter(c => c.type === 'income' && (c.source_type === 'general' || !c.source_type));
  const generalExpense = filteredCategories.filter(c => c.type === 'expense' && (c.source_type === 'general' || !c.source_type));
  const creditCardCategories = filteredCategories.filter(c => c.source_type === 'credit_card');
  const investmentCategories = filteredCategories.filter(c => c.source_type === 'investment');
  const goalCategories = filteredCategories.filter(c => c.source_type === 'goal');
  const debtCategories = filteredCategories.filter(c => c.source_type === 'debt');

  // For backward compatibility
  const incomeCategories = filteredCategories.filter(c => c.type === 'income');
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-full">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-2xl md:text-3xl font-bold">Categorias</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Organize suas transações por categoria</p>
        </div>
        <Button onClick={openNewDialog} className="btn-primary w-full sm:w-auto flex-shrink-0">
          <i className='bx bx-plus mr-2'></i>
          <span className="hidden sm:inline">Nova Categoria</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 max-w-full">
        <div className="flex flex-col gap-4 max-w-full">
          <div className="flex-1 relative min-w-0">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <Input
              placeholder="Buscar categorias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full max-w-full"
            />
          </div>
          <div className="flex flex-col gap-3 max-w-full">
            {/* Type Filters */}
            <div className="flex flex-wrap gap-2 max-w-full">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Receitas
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Despesas
              </button>
            </div>

            {/* Source Filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterSource('all')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterSource === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Todas Origens
              </button>
              <button
                onClick={() => setFilterSource('general')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterSource === 'general'
                  ? 'bg-blue-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Gerais
              </button>
              <button
                onClick={() => setFilterSource('credit_card')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterSource === 'credit_card'
                  ? 'bg-pink-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Cartões
              </button>
              <button
                onClick={() => setFilterSource('investment')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterSource === 'investment'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Investimentos
              </button>
              <button
                onClick={() => setFilterSource('goal')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterSource === 'goal'
                  ? 'bg-green-600 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Objetivos
              </button>
              <button
                onClick={() => setFilterSource('debt')}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${filterSource === 'debt'
                  ? 'bg-red-600 text-white'
                  : 'bg-muted hover:bg-muted/80'
                  }`}
              >
                Dívidas
              </button>
            </div>

            {/* Show Inactive Toggle */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <label className="flex items-center gap-2 px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer hover:bg-muted/80">
                <Switch
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <span>Mostrar inativas</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <i className='bx bx-loader-alt bx-spin text-4xl text-primary'></i>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className='bx bx-category text-6xl text-muted-foreground mb-4'></i>
          <h3 className="text-lg font-medium mb-2">Nenhuma categoria encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando sua primeira categoria'}
          </p>
          {!searchTerm && (
            <Button onClick={openNewDialog}>
              <i className='bx bx-plus mr-2'></i>
              Adicionar Categoria
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6 max-w-full">
          {/* General Income Categories */}
          {(filterType === 'all' || filterType === 'income') && (filterSource === 'all' || filterSource === 'general') && generalIncome.length > 0 && (
            <div className="max-w-full">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Receitas ({generalIncome.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-w-full">
                {generalIncome.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={categoriesWithTransactions.get(category.id) || 0}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(category)}
                    onMigrate={() => handleOpenMigration(category)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* General Expense Categories */}
          {(filterType === 'all' || filterType === 'expense') && (filterSource === 'all' || filterSource === 'general') && generalExpense.length > 0 && (
            <div className="max-w-full">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                Despesas ({generalExpense.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-w-full">
                {generalExpense.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={categoriesWithTransactions.get(category.id) || 0}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(category)}
                    onMigrate={() => handleOpenMigration(category)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Credit Card Categories */}
          {(filterSource === 'all' || filterSource === 'credit_card') && creditCardCategories.length > 0 && (
            <div className="max-w-full">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-500"></span>
                Cartões de Crédito ({creditCardCategories.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-w-full">
                {creditCardCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={categoriesWithTransactions.get(category.id) || 0}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(category)}
                    onMigrate={() => handleOpenMigration(category)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Investment Categories */}
          {(filterSource === 'all' || filterSource === 'investment') && investmentCategories.length > 0 && (
            <div className="max-w-full">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                Investimentos ({investmentCategories.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-w-full">
                {investmentCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={categoriesWithTransactions.get(category.id) || 0}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(category)}
                    onMigrate={() => handleOpenMigration(category)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Goal Categories */}
          {(filterSource === 'all' || filterSource === 'goal') && goalCategories.length > 0 && (
            <div className="max-w-full">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-600"></span>
                Objetivos ({goalCategories.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-w-full">
                {goalCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={categoriesWithTransactions.get(category.id) || 0}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(category)}
                    onMigrate={() => handleOpenMigration(category)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Debt Categories */}
          {(filterSource === 'all' || filterSource === 'debt') && debtCategories.length > 0 && (
            <div className="max-w-full">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
                Dívidas ({debtCategories.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3 max-w-full">
                {debtCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    transactionCount={categoriesWithTransactions.get(category.id) || 0}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                    onToggleActive={() => handleToggleActive(category)}
                    onMigrate={() => handleOpenMigration(category)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Modifique os dados da categoria' : 'Adicione uma nova categoria'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da categoria"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tipo</label>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${formData.type === 'expense'
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                    }`}
                >
                  <i className='bx bx-minus-circle mr-2'></i>
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${formData.type === 'income'
                    ? 'border-green-500 bg-green-500/10 text-green-500'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                    }`}
                >
                  <i className='bx bx-plus-circle mr-2'></i>
                  Receita
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {categoryColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Ícone</label>
              <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                {categoryIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`w-8 h-8 rounded border-2 text-lg transition-transform ${formData.icon === icon ? 'border-foreground scale-110' : 'border-muted'
                      }`}
                    onClick={() => setFormData({ ...formData, icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingCategory && (!editingCategory.source_type || editingCategory.source_type === 'general') && (
              <Button
                variant="outline"
                onClick={() => {
                  closeDialog();
                  handleOpenMigration(editingCategory);
                }}
                className="w-full sm:w-auto"
              >
                <i className='bx bx-arrow-right-left mr-2'></i>
                Migrar Transações
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={closeDialog} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="flex-1 sm:flex-none">
                {editingCategory ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration Modal */}
      {categoryToMigrate && (
        <CategoryMigrationModal
          open={migrationModalOpen}
          onOpenChange={setMigrationModalOpen}
          sourceCategory={{
            ...categoryToMigrate,
            transaction_count: categoriesWithTransactions.get(categoryToMigrate.id) || 0,
          }}
          onSuccess={handleMigrationSuccess}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Categoria</DialogTitle>
            <DialogDescription>
              {categoryToDelete && categoriesWithTransactions.get(categoryToDelete.id) ? (
                <>
                  A categoria "{categoryToDelete.name}" possui {categoriesWithTransactions.get(categoryToDelete.id)} transação(ões).
                  <br />
                  <br />
                  Não é possível excluir uma categoria que possui transações. Use a opção "Migrar Transações" para transferir as transações para outra categoria antes de excluir.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a categoria "{categoryToDelete?.name}"?
                  Esta ação não pode ser desfeita.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            {categoryToDelete && !categoriesWithTransactions.get(categoryToDelete.id) && (
              <Button variant="destructive" onClick={handleDelete}>
                Excluir
              </Button>
            )}
            {categoryToDelete && categoriesWithTransactions.get(categoryToDelete.id) && (
              <Button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  handleOpenMigration(categoryToDelete);
                }}
              >
                <i className='bx bx-arrow-right-left mr-2'></i>
                Migrar Transações
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Category Card Component
function CategoryCard({
  category,
  transactionCount = 0,
  onEdit,
  onDelete,
  onToggleActive,
  onMigrate,
}: {
  category: Category;
  transactionCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onMigrate: () => void;
}) {
  const isInactive = category.is_active === false;
  const isGeneralCategory = !category.source_type || category.source_type === 'general';
  const canDelete = transactionCount === 0;

  return (
    <div className={`glass-card relative p-3 hover:shadow-lg transition-all group overflow-hidden ${isInactive ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110"
          style={{ backgroundColor: (category.color || '#3b82f6') + '20' }}
        >
          {category.icon || '📁'}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate text-base flex-1 min-w-0" title={category.name}>{category.name}</h3>
            {transactionCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-500 rounded flex-shrink-0">
                {transactionCount}
              </span>
            )}
          </div>
          <span className={`text-xs block mt-0.5 font-medium ${category.type === 'income'
            ? 'text-green-500'
            : category.source_type === 'goal'
              ? 'text-blue-500'
              : category.source_type === 'debt'
                ? 'text-orange-500'
                : category.source_type === 'credit_card'
                  ? 'text-pink-500'
                  : category.source_type === 'investment'
                    ? 'text-cyan-500'
                    : 'text-red-500'
            }`}>
            {isInactive ? (
              <span className="text-muted-foreground">Inativa</span>
            ) : category.type === 'income'
              ? 'Receita'
              : category.source_type === 'goal'
                ? 'Objetivo'
                : category.source_type === 'debt'
                  ? 'Dívida'
                  : category.source_type === 'credit_card'
                    ? 'Cartão'
                    : category.source_type === 'investment'
                      ? 'Investimento'
                      : 'Despesa'}
          </span>
        </div>

        {/* Action Buttons - Compact Single Row */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 bg-card/95 backdrop-blur-md rounded-lg p-1.5 shadow-lg border border-border/50 z-20">
          {isGeneralCategory && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit();
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-md transition-colors text-foreground"
                title="Editar"
              >
                <i className='bx bx-edit text-lg'></i>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMigrate();
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-blue-500/10 text-blue-500 rounded-md transition-colors"
                title={transactionCount > 0 ? "Migrar transações" : "Migrar categoria"}
              >
                <i className='bx bx-arrow-right-left text-lg'></i>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleActive();
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${category.is_active === false
                  ? 'hover:bg-green-500/10 text-muted-foreground hover:text-green-500'
                  : 'hover:bg-amber-500/10 text-foreground hover:text-amber-500'
                  }`}
                title={category.is_active === false ? "Ativar" : "Inativar"}
              >
                <i className={`bx ${category.is_active === false ? 'bx-toggle-left' : 'bx-toggle-right'} text-2xl`}></i>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={!canDelete}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${canDelete
                  ? 'hover:bg-red-500/10 text-red-500'
                  : 'opacity-50 cursor-not-allowed text-muted-foreground'
                  }`}
                title={canDelete ? 'Excluir' : 'Não é possível excluir categoria com transações'}
              >
                <i className='bx bx-trash text-lg'></i>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
