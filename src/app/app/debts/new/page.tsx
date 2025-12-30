'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewDebtPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    creditor_name: '',
    total_amount_cents: '',
    paid_amount_cents: '0',
    interest_rate: '0',
    due_date: '',
    status: 'active',
    priority: 'medium',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          total_amount_cents: Math.round(parseFloat(formData.total_amount_cents) * 100),
          paid_amount_cents: Math.round(parseFloat(formData.paid_amount_cents || '0') * 100),
          interest_rate: parseFloat(formData.interest_rate || '0'),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar dívida');
      }

      router.push('/app/debts');
    } catch (error: any) {
      alert(error.message || 'Erro ao criar dívida');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/debts" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Nova Dívida</h1>
          <p className="text-muted-foreground">Adicione uma nova dívida para acompanhar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nome da Dívida *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Cartão de Crédito"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Credor</label>
            <input
              type="text"
              value={formData.creditor_name}
              onChange={(e) => setFormData({ ...formData, creditor_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Banco XYZ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Total (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.total_amount_cents}
              onChange={(e) => setFormData({ ...formData, total_amount_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Já Pago (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.paid_amount_cents}
              onChange={(e) => setFormData({ ...formData, paid_amount_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Taxa de Juros (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.interest_rate}
              onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Data de Vencimento</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="active">Ativa</option>
              <option value="paid">Paga</option>
              <option value="overdue">Vencida</option>
              <option value="negotiating">Negociando</option>
            </select>
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
              <option value="urgent">Urgente</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder="Observações sobre a dívida..."
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
            {loading ? 'Salvando...' : 'Criar Dívida'}
          </button>
          <Link href="/app/debts" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

