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
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

export default function NewReceivablePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    debtor_name: '',
    total_amount_cents: '',
    received_amount_cents: '0',
    interest_rate: '0',
    due_date: '',
    status: 'pendente',
    priority: 'medium',
    notes: '',
    payment_frequency: '',
    payment_amount_cents: '',
    installment_count: '',
    include_in_plan: true,
    contribution_frequency: 'monthly',
    monthly_payment_cents: '',
    start_date: '',
  });
  const [useCustomPlan, setUseCustomPlan] = useState(false);
  const [planEntries, setPlanEntries] = useState<Array<{ month: string; amount: string }>>([
    { month: '', amount: '' },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanedPlanEntries = planEntries
        .map((entry) => ({
          month: entry.month,
          amount: parseFloat(entry.amount),
        }))
        .filter((entry) => entry.month && !Number.isNaN(entry.amount) && entry.amount > 0);

      if (useCustomPlan && cleanedPlanEntries.length === 0) {
        toast({
          variant: "destructive",
          title: "Plano personalizado incompleto",
          description: "Adicione ao menos um mês com valor válido.",
        });
        setLoading(false);
        return;
      }

      // Validate custom plan total if using custom plan
      if (useCustomPlan && cleanedPlanEntries.length > 0) {
        const totalAmount = parseFloat(formData.total_amount_cents) * 100;
        const receivedAmount = parseFloat(formData.received_amount_cents || '0') * 100;
        const remainingAmount = totalAmount - receivedAmount;
        const planTotal = cleanedPlanEntries.reduce((sum, entry) => sum + (entry.amount * 100), 0);

        if (planTotal < remainingAmount) {
          toast({
            variant: "default",
            title: "Atenção: Valor do plano personalizado",
            description: `O total do plano personalizado (${(planTotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) é menor que o valor restante do recebível (${(remainingAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
          });
        }
      }

      // Validate installment calculation if status is 'negociada'
      if (formData.status === 'negociada') {
        const paymentAmount = parseFloat(formData.payment_amount_cents) * 100;
        const installmentCount = parseInt(formData.installment_count || '0');
        const totalAmount = parseFloat(formData.total_amount_cents) * 100;
        const totalFromInstallments = paymentAmount * installmentCount;

        if (totalFromInstallments > totalAmount) {
          const confirmed = await confirm({
            title: 'Ajustar Valor do Recebível',
            description: `O valor total das parcelas (${(totalFromInstallments / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) é maior que o valor do recebível (${(totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Deseja ajustar o valor total do recebível para ${(totalFromInstallments / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`,
            confirmText: 'Ajustar',
            cancelText: 'Cancelar',
          });

          if (confirmed) {
            formData.total_amount_cents = (totalFromInstallments / 100).toFixed(2);
          }
        }
      }

      const response = await fetch('/api/receivables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          debtor_name: formData.debtor_name || undefined,
          total_amount_cents: Math.round(parseFloat(formData.total_amount_cents) * 100),
          received_amount_cents: Math.round(parseFloat(formData.received_amount_cents || '0') * 100),
          interest_rate_monthly: parseFloat(formData.interest_rate || '0'),
          due_date: formData.due_date || undefined,
          status: formData.status,
          priority: formData.priority,
          notes: formData.notes || undefined,
          include_in_plan: formData.include_in_plan || useCustomPlan,
          payment_frequency: formData.status === 'negociada' ? formData.payment_frequency : undefined,
          payment_amount_cents: formData.status === 'negociada' && formData.payment_amount_cents
            ? Math.round(parseFloat(formData.payment_amount_cents) * 100)
            : undefined,
          installment_count: formData.status === 'negociada' && formData.installment_count
            ? parseInt(formData.installment_count)
            : undefined,
          contribution_frequency: !useCustomPlan && formData.include_in_plan && formData.contribution_frequency
            ? formData.contribution_frequency
            : undefined,
          monthly_payment_cents: !useCustomPlan && formData.include_in_plan && formData.monthly_payment_cents
            ? Math.round(parseFloat(formData.monthly_payment_cents) * 100)
            : undefined,
          start_date: !useCustomPlan && formData.include_in_plan && formData.start_date
            ? formData.start_date
            : undefined,
          plan_entries: useCustomPlan
            ? cleanedPlanEntries.map((entry) => ({
                month: entry.month,
                amount_cents: Math.round(entry.amount * 100),
              }))
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar recebível');
      }

      router.push('/app/receivables');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar recebível",
        description: error.message || "Ocorreu um erro ao tentar criar o recebível",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/receivables" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Novo Recebível</h1>
          <p className="text-muted-foreground">Adicione um novo recebível para acompanhar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nome do Recebível *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Empréstimo para João"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Devedor</label>
            <input
              type="text"
              value={formData.debtor_name}
              onChange={(e) => setFormData({ ...formData, debtor_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: João Silva"
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
            <label className="block text-sm font-medium mb-2">Valor Já Recebido (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.received_amount_cents}
              onChange={(e) => setFormData({ ...formData, received_amount_cents: e.target.value })}
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
            <DatePicker
              date={formData.due_date ? new Date(formData.due_date) : undefined}
              setDate={(date) => {
                if (date) {
                  const formattedDate = format(date, 'yyyy-MM-dd');
                  setFormData({ ...formData, due_date: formattedDate });
                }
              }}
              placeholder="Selecione a data de vencimento"
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
              <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="negociada">Negociada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prioridade</label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder="Observações sobre o recebível..."
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

        <div className="border-t pt-6 space-y-4">
          <h3 className="font-semibold mb-4">Informações de Negociação</h3>
          <p className="text-sm text-muted-foreground">
            As informações ficam visíveis e são aplicadas quando o status for &quot;Negociada&quot;.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Frequência de Recebimento *</label>
              <Select
                value={formData.payment_frequency}
                onValueChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                required={formData.status === 'negociada'}
                disabled={formData.status !== 'negociada'}
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
              <label className="block text-sm font-medium mb-2">Valor de Recebimento Periódico (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.payment_amount_cents}
                onChange={(e) => setFormData({ ...formData, payment_amount_cents: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0.00"
                required={formData.status === 'negociada'}
                disabled={formData.status !== 'negociada'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Número de Parcelas *</label>
              <input
                type="number"
                min="1"
                value={formData.installment_count}
                onChange={(e) => setFormData({ ...formData, installment_count: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0"
                required={formData.status === 'negociada'}
                disabled={formData.status !== 'negociada'}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="include_in_plan"
                checked={formData.include_in_plan}
                onCheckedChange={(checked) => setFormData({ ...formData, include_in_plan: checked === true })}
                disabled={useCustomPlan}
              />
              <label htmlFor="include_in_plan" className="text-sm font-medium cursor-pointer">
                Incluir no orçamento e projeções
              </label>
            </div>
          </div>

          {formData.include_in_plan && (
            <div className="grid md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/30">
              <div className="md:col-span-2 flex items-center gap-3">
                <Checkbox
                  id="use_custom_plan"
                  checked={useCustomPlan}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setUseCustomPlan(enabled);
                    if (enabled) {
                      setFormData((prev) => ({ ...prev, include_in_plan: true }));
                    }
                  }}
                />
                <label htmlFor="use_custom_plan" className="text-sm font-medium cursor-pointer">
                  Usar plano personalizado de recebimentos
                </label>
              </div>

              {useCustomPlan && (
                <div className="md:col-span-2 space-y-3">
                  {planEntries.map((entry, index) => (
                    <div key={index} className="grid md:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-sm font-medium mb-2">Mês</label>
                        <input
                          type="month"
                          value={entry.month}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPlanEntries((prev) =>
                              prev.map((item, idx) => idx === index ? { ...item, month: value } : item)
                            );
                          }}
                          className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPlanEntries((prev) =>
                              prev.map((item, idx) => idx === index ? { ...item, amount: value } : item)
                            );
                          }}
                          className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setPlanEntries((prev) => [...prev, { month: '', amount: '' }])}
                        >
                          + Adicionar
                        </button>
                        {planEntries.length > 1 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setPlanEntries((prev) => prev.filter((_, idx) => idx !== index))}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!useCustomPlan && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Frequência de Recebimento *</label>
                    <Select
                      value={formData.contribution_frequency}
                      onValueChange={(value) => setFormData({ ...formData, contribution_frequency: value })}
                      required={formData.include_in_plan}
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
                    <label className="block text-sm font-medium mb-2">Valor Mensal do Recebimento (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthly_payment_cents}
                      onChange={(e) => setFormData({ ...formData, monthly_payment_cents: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor mensal calculado automaticamente baseado na frequência, ou defina manualmente
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Mês Inicial dos Recebimentos</label>
                    <input
                      type="month"
                      value={formData.start_date ? formData.start_date.substring(0, 7) : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value) {
                          setFormData({ ...formData, start_date: `${value}-01` });
                        } else {
                          setFormData({ ...formData, start_date: '' });
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Mês em que se iniciam os recebimentos no orçamento
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Recebível'}
          </button>
          <Link href="/app/receivables" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>

      {/* Adjust Value Confirmation Dialog */}
      {ConfirmDialog}
    </div>
  );
}
