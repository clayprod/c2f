'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function NewInvestmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
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
    include_in_budget: true,
    contribution_frequency: 'monthly',
    monthly_contribution_cents: '',
    create_purchase_transaction: false,
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
          monthly_contribution_cents: formData.monthly_contribution_cents
            ? Math.round(parseFloat(formData.monthly_contribution_cents) * 100)
            : undefined,
          contribution_frequency: formData.include_in_budget && formData.contribution_frequency
            ? formData.contribution_frequency
            : undefined,
          create_purchase_transaction: formData.create_purchase_transaction,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar investimento');
      }

      router.push('/app/investments');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar investimento",
        description: error.message || "Ocorreu um erro ao tentar criar o investimento",
      });
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
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
              required
            >
              <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stocks">Ações</SelectItem>
                <SelectItem value="bonds">Títulos</SelectItem>
                <SelectItem value="funds">Fundos</SelectItem>
                <SelectItem value="crypto">Criptomoedas</SelectItem>
                <SelectItem value="real_estate">Imóveis</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
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
            <DatePicker
              date={formData.purchase_date ? new Date(formData.purchase_date) : undefined}
              setDate={(date) => {
                if (date) {
                  const formattedDate = format(date, 'yyyy-MM-dd');
                  setFormData({ ...formData, purchase_date: formattedDate });
                }
              }}
              placeholder="Selecione a data de compra"
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
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="sold">Vendido</SelectItem>
                <SelectItem value="matured">Vencido</SelectItem>
              </SelectContent>
            </Select>
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

        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="create_purchase_transaction"
              checked={formData.create_purchase_transaction}
              onCheckedChange={(checked) => setFormData({ ...formData, create_purchase_transaction: checked === true })}
            />
            <label htmlFor="create_purchase_transaction" className="text-sm font-medium cursor-pointer">
              Criar transação de compra automaticamente
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="include_in_budget"
              checked={formData.include_in_budget}
              onCheckedChange={(checked) => setFormData({ ...formData, include_in_budget: checked === true })}
            />
            <label htmlFor="include_in_budget" className="text-sm font-medium cursor-pointer">
              Incluir no orçamento
            </label>
          </div>

          {formData.include_in_budget && (
            <div className="grid md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/30">
              <div>
                <label className="block text-sm font-medium mb-2">Frequência de Aporte *</label>
                <Select
                  value={formData.contribution_frequency}
                  onValueChange={(value) => setFormData({ ...formData, contribution_frequency: value })}
                  required={formData.include_in_budget}
                >
                  <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Valor Mensal do Aporte (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthly_contribution_cents}
                  onChange={(e) => setFormData({ ...formData, monthly_contribution_cents: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor mensal calculado automaticamente baseado na frequência, ou defina manualmente
                </p>
              </div>
            </div>
          )}
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

