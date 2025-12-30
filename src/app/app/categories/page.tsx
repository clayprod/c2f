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

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
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
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    icon: '📁',
    color: '#3b82f6',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as categorias',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || category.type === filterType;
    return matchesSearch && matchesType;
  });

  const incomeCategories = filteredCategories.filter(c => c.type === 'income');
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Categorias</h1>
          <p className="text-muted-foreground">Organize suas transações por categoria</p>
        </div>
        <Button onClick={openNewDialog} className="btn-primary">
          <i className='bx bx-plus mr-2'></i>
          Nova Categoria
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <Input
              placeholder="Buscar categorias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Receitas
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              Despesas
            </button>
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
        <div className="space-y-6">
          {/* Income Categories */}
          {(filterType === 'all' || filterType === 'income') && incomeCategories.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Receitas ({incomeCategories.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {incomeCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Expense Categories */}
          {(filterType === 'all' || filterType === 'expense') && expenseCategories.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                Despesas ({expenseCategories.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {expenseCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={() => openEditDialog(category)}
                    onDelete={() => {
                      setCategoryToDelete(category);
                      setDeleteDialogOpen(true);
                    }}
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
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                    formData.type === 'expense'
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
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                    formData.type === 'income'
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
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
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
                    className={`w-8 h-8 rounded border-2 text-lg transition-transform ${
                      formData.icon === icon ? 'border-foreground scale-110' : 'border-muted'
                    }`}
                    onClick={() => setFormData({ ...formData, icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Categoria</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a categoria "{categoryToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Category Card Component
function CategoryCard({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="glass-card p-3 hover:shadow-lg transition-shadow group">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: (category.color || '#3b82f6') + '20' }}
        >
          {category.icon || '📁'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{category.name}</h3>
          <span className={`text-xs ${category.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
            {category.type === 'income' ? 'Receita' : 'Despesa'}
          </span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <i className='bx bx-edit text-sm'></i>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
          >
            <i className='bx bx-trash text-sm'></i>
          </button>
        </div>
      </div>
    </div>
  );
}
