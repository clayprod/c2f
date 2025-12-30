'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewInvestmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'stocks',
    institution: '',
    initial_investment_cents: '',
    current_value_cents: '',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: '',
    unit_price_cents: '',
    status: 'active',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          initial_investment_cents: Math.round(parseFloat(formData.initial_investment_cents) * 100),
          current_value_cents: formData.current_value_cents
            ? Math.round(parseFloat(formData.current_value_cents) * 100)
            : undefined,
          quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
          unit_price_cents: formData.unit_price_cents
            ? Math.round(parseFloat(formData.unit_price_cents) * 100)
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar investimento');
      }

      router.push('/app/investments');
    } catch (error: any) {
      alert(error.message || 'Erro ao criar investimento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/investments" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Novo Investimento</h1>
          <p className="text-muted-foreground">Adicione um novo investimento para acompanhar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nome do Investimento *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Ações PETR4"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tipo *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            >
              <option value="stocks">Ações</option>
              <option value="bonds">Títulos</option>
              <option value="funds">Fundos</option>
              <option value="crypto">Criptomoedas</option>
              <option value="real_estate">Imóveis</option>
              <option value="other">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Instituição</label>
            <input
              type="text"
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: XP Investimentos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Data de Compra *</label>
            <input
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Investido (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.initial_investment_cents}
              onChange={(e) => setFormData({ ...formData, initial_investment_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Atual (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.current_value_cents}
              onChange={(e) => setFormData({ ...formData, current_value_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Deixe vazio para usar o valor investido"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Quantidade</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: 100 (ações, moedas, etc)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Preço Unitário (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.unit_price_cents}
              onChange={(e) => setFormData({ ...formData, unit_price_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="active">Ativo</option>
              <option value="sold">Vendido</option>
              <option value="matured">Vencido</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notas</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder="Observações sobre o investimento..."
          />
        </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Investimento'}
          </button>
          <Link href="/app/investments" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

