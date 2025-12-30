'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewGoalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount_cents: '',
    current_amount_cents: '0',
    target_date: '',
    status: 'active',
    priority: 'medium',
    icon: '🎯',
    color: '#6b7280',
    notes: '',
  });

  const iconOptions = ['🎯', '💰', '🏠', '🚗', '✈️', '💍', '🎓', '💻', '📱', '🎮', '🏖️', '💎'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          target_amount_cents: Math.round(parseFloat(formData.target_amount_cents) * 100),
          current_amount_cents: Math.round(parseFloat(formData.current_amount_cents || '0') * 100),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar objetivo');
      }

      router.push('/app/goals');
    } catch (error: any) {
      alert(error.message || 'Erro ao criar objetivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/goals" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Novo Objetivo</h1>
          <p className="text-muted-foreground">Crie uma meta e comece a poupar com "caixinhas"</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nome do Objetivo *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Viagem para Europa"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meta (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.target_amount_cents}
              onChange={(e) => setFormData({ ...formData, target_amount_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.current_amount_cents}
              onChange={(e) => setFormData({ ...formData, current_amount_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Data Objetivo</label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prioridade</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Ícone</label>
          <div className="flex gap-2 flex-wrap">
            {iconOptions.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setFormData({ ...formData, icon })}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl transition-all ${
                  formData.icon === icon
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Cor</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-16 h-12 rounded-xl border border-border cursor-pointer"
            />
            <input
              type="text"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="#6b7280"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder="Descreva seu objetivo..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notas</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={2}
            placeholder="Notas adicionais..."
          />
        </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Objetivo'}
          </button>
          <Link href="/app/goals" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

