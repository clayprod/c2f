'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Category {
  id: string;
  name: string;
  type: string;
  color?: string;
}

interface Budget {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount_planned: number;
  amount_actual?: number;
  categories?: Category;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formData, setFormData] = useState({
    category_id: '',
    limit_cents: 0,
    month: selectedMonth,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      // Filter only expense categories for budgets
      const expenseCategories = (data.data || []).filter((c: Category) => c.type === 'expense');
      setCategories(expenseCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/budgets?month=${selectedMonth}`);
      const data = await res.json();
      setBudgets(data.data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os orcamentos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          limit_cents: Math.round(formData.limit_cents * 100),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar orcamento');
      }

      toast({
        title: 'Sucesso',
        description: 'Orcamento criado com sucesso',
      });

      setFormOpen(false);
      setFormData({ category_id: '', limit_cents: 0, month: selectedMonth });
      fetchBudgets();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
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

  const totalPlanned = budgets.reduce((sum, b) => sum + (b.amount_planned || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.amount_actual || 0), 0);
  const totalRemaining = totalPlanned - totalSpent;

  const gradientColors = [
    'from-orange-500 to-red-500',
    'from-blue-500 to-cyan-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Orcamentos</h1>
          <p className="text-muted-foreground">Defina limites e acompanhe seus gastos</p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
          />
          <Button onClick={() => setFormOpen(true)} className="btn-primary">
            <i className='bx bx-plus'></i>
            Novo Orcamento
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <i className='bx bx-target-lock text-xl text-primary'></i>
            </div>
            <span className="text-sm text-muted-foreground">Total Orcado</span>
          </div>
          <p className="font-display text-2xl font-bold">{formatCurrency(totalPlanned)}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <i className='bx bx-pie-chart-alt-2 text-xl text-yellow-500'></i>
            </div>
            <span className="text-sm text-muted-foreground">Total Gasto</span>
          </div>
          <p className="font-display text-2xl font-bold">{formatCurrency(totalSpent)}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              totalRemaining >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <i className={`bx bx-check-circle text-xl ${
                totalRemaining >= 0 ? 'text-green-500' : 'text-red-500'
              }`}></i>
            </div>
            <span className="text-sm text-muted-foreground">Disponivel</span>
          </div>
          <p className={`font-display text-2xl font-bold ${
            totalRemaining >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {formatCurrency(totalRemaining)}
          </p>
        </div>
      </div>

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className='bx bx-target-lock text-4xl text-muted-foreground mb-4'></i>
          <h3 className="font-display font-semibold mb-2">Nenhum orcamento para {getMonthLabel(selectedMonth)}</h3>
          <p className="text-muted-foreground mb-6">
            Crie orcamentos para controlar seus gastos por categoria
          </p>
          <Button onClick={() => setFormOpen(true)} className="btn-primary">
            <i className='bx bx-plus'></i>
            Criar Orcamento
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {budgets.map((budget, index) => {
            const spent = budget.amount_actual || 0;
            const limit = budget.amount_planned || 0;
            const percentage = limit > 0 ? (spent / limit) * 100 : 0;
            const isOver = spent > limit;
            const colorClass = gradientColors[index % gradientColors.length];

            return (
              <div key={budget.id} className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-lg">
                    {budget.categories?.name || 'Categoria'}
                  </h3>
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

                {isOver && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-sm text-red-500">
                      <i className='bx bx-error-circle'></i> Voce ultrapassou o limite em {formatCurrency(spent - limit)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
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
                min="0"
                step="0.01"
                value={formData.limit_cents}
                onChange={(e) => setFormData({ ...formData, limit_cents: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mes</label>
              <input
                type="month"
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !formData.category_id || formData.limit_cents <= 0}
                className="btn-primary flex-1"
              >
                {saving ? 'Salvando...' : 'Criar Orcamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
