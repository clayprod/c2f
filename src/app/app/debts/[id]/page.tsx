'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Debt {
  id: string;
  name: string;
  description?: string;
  creditor_name?: string;
  total_amount_cents: number;
  paid_amount_cents: number;
  remaining_amount_cents: number;
  interest_rate?: number;
  due_date?: string;
  start_date?: string;
  status: string;
  priority: string;
  notes?: string;
  payment_frequency?: string;
  payment_amount_cents?: number;
  installment_count?: number;
  debt_payments?: Array<{
    id: string;
    amount_cents: number;
    payment_date: string;
    notes?: string;
  }>;
}

export default function DebtDetailPage() {
  const router = useRouter();
  const params = useParams();
  const debtId = params?.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    creditor_name: '',
    total_amount_cents: '',
    paid_amount_cents: '0',
    interest_rate: '0',
    due_date: '',
    status: 'pendente',
    priority: 'medium',
    notes: '',
    payment_frequency: '',
    payment_amount_cents: '',
    installment_count: '',
    include_in_plan: true,
  });
  const [useCustomPlan, setUseCustomPlan] = useState(false);
  const [planEntries, setPlanEntries] = useState<Array<{ month: string; amount: string }>>([
    { month: '', amount: '' },
  ]);

  useEffect(() => {
    if (debtId) {
      fetchDebt();
    }
  }, [debtId]);

  const fetchDebt = async () => {
    try {
      const response = await fetch(`/api/debts/${debtId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/app/debts');
          return;
        }
        throw new Error('Erro ao carregar dívida');
      }
      const result = await response.json();
      const debtData = result.data;
      setDebt(debtData);
      
      // Populate form data
      setFormData({
        name: debtData.name || '',
        description: debtData.description || '',
        creditor_name: debtData.creditor_name || '',
        total_amount_cents: (debtData.total_amount_cents / 100).toFixed(2),
        paid_amount_cents: (debtData.paid_amount_cents / 100).toFixed(2),
        interest_rate: debtData.interest_rate?.toString() || '0',
        due_date: debtData.due_date || '',
        status: debtData.status || 'pendente',
        priority: debtData.priority || 'medium',
        notes: debtData.notes || '',
        payment_frequency: debtData.payment_frequency || '',
        payment_amount_cents: debtData.payment_amount_cents ? (debtData.payment_amount_cents / 100).toFixed(2) : '',
        installment_count: debtData.installment_count?.toString() || '',
        include_in_plan: debtData.include_in_plan ?? false,
      });
      if (debtData.plan_entries && debtData.plan_entries.length > 0) {
        setUseCustomPlan(true);
        setPlanEntries(
          debtData.plan_entries.map((entry: any) => ({
            month: entry.entry_month?.slice(0, 7),
            amount: ((entry.amount_cents || 0) / 100).toString(),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching debt:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dívida",
        description: "Ocorreu um erro ao tentar carregar os dados da dívida",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

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
        setSaving(false);
        return;
      }

      // Validate installment calculation if status is 'negociada'
      if (formData.status === 'negociada') {
        const paymentAmount = parseFloat(formData.payment_amount_cents) * 100;
        const installmentCount = parseInt(formData.installment_count || '0');
        const totalAmount = parseFloat(formData.total_amount_cents) * 100;
        const totalFromInstallments = paymentAmount * installmentCount;

        if (totalFromInstallments > totalAmount) {
          const confirmAdjust = confirm(
            `O valor total das parcelas (${(totalFromInstallments / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) é maior que o valor da dívida (${(totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Deseja ajustar o valor total da dívida para ${(totalFromInstallments / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`
          );

          if (confirmAdjust) {
            setFormData({
              ...formData,
              total_amount_cents: (totalFromInstallments / 100).toFixed(2),
            });
            // Update the form data and continue
            const updatedFormData = {
              ...formData,
              total_amount_cents: (totalFromInstallments / 100).toFixed(2),
            };
            await saveDebt(updatedFormData, cleanedPlanEntries);
            return;
          }
        }
      }

      await saveDebt(formData, cleanedPlanEntries);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar dívida",
        description: error.message || "Ocorreu um erro ao tentar salvar a dívida",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveDebt = async (
    data: typeof formData,
    cleanedPlanEntries: Array<{ month: string; amount: number }>
  ) => {
    const response = await fetch(`/api/debts/${debtId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        creditor_name: data.creditor_name || undefined,
        total_amount_cents: Math.round(parseFloat(data.total_amount_cents) * 100),
        paid_amount_cents: Math.round(parseFloat(data.paid_amount_cents || '0') * 100),
        interest_rate_monthly: parseFloat(data.interest_rate || '0'),
        due_date: data.due_date || undefined,
        status: data.status,
        priority: data.priority,
        notes: data.notes || undefined,
        include_in_plan: data.include_in_plan || useCustomPlan,
        payment_frequency: data.status === 'negociada' ? data.payment_frequency : undefined,
        payment_amount_cents: data.status === 'negociada' && data.payment_amount_cents
          ? Math.round(parseFloat(data.payment_amount_cents) * 100)
          : undefined,
        installment_count: data.status === 'negociada' && data.installment_count
          ? parseInt(data.installment_count)
          : undefined,
        plan_entries: useCustomPlan
          ? cleanedPlanEntries.map((entry) => ({
              month: entry.month,
              amount_cents: Math.round(entry.amount * 100),
            }))
          : [],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao salvar dívida');
    }

    setIsEditing(false);
    fetchDebt();
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      negociada: 'Negociada',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!debt) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/debts" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl md:text-3xl font-bold">{debt.name}</h1>
          <p className="text-muted-foreground">Detalhes e edição da dívida</p>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="btn-primary">
            <i className='bx bx-edit'></i>
            Editar
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nome da Dívida *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold mb-4">Informações de Negociação</h3>
            <p className="text-sm text-muted-foreground">
              As informações ficam visíveis e são aplicadas quando o status for &quot;Negociada&quot;.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Frequência de Pagamento *</label>
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
                <label className="block text-sm font-medium mb-2">Valor de Pagamento Periódico (R$) *</label>
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
                    Usar plano personalizado de pagamentos
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
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
            />
          </div>

          <div className="flex gap-4">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                fetchDebt();
              }}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="glass-card p-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <p className="font-semibold">{getStatusLabel(debt.status)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Prioridade</p>
                <p className="font-semibold capitalize">{debt.priority}</p>
              </div>
              {debt.due_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vencimento</p>
                  <p className="font-semibold">{new Date(debt.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(debt.total_amount_cents)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Pago</p>
                  <p className="text-2xl font-bold text-green-500">{formatCurrency(debt.paid_amount_cents)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Restante</p>
                  <p className="text-2xl font-bold text-red-500">{formatCurrency(debt.remaining_amount_cents)}</p>
                </div>
              </div>
            </div>

            {debt.status === 'negociada' && (debt.payment_frequency || debt.payment_amount_cents || debt.installment_count) && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Informações de Negociação</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  {debt.payment_frequency && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Frequência</p>
                      <p className="font-semibold">
                        {debt.payment_frequency === 'daily' ? 'Diário' :
                         debt.payment_frequency === 'weekly' ? 'Semanal' :
                         debt.payment_frequency === 'biweekly' ? 'Quinzenal' :
                         debt.payment_frequency === 'monthly' ? 'Mensal' :
                         debt.payment_frequency === 'quarterly' ? 'Trimestral' :
                         debt.payment_frequency === 'yearly' ? 'Anual' : debt.payment_frequency}
                      </p>
                    </div>
                  )}
                  {debt.payment_amount_cents && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Valor por Parcela</p>
                      <p className="font-semibold">{formatCurrency(debt.payment_amount_cents)}</p>
                    </div>
                  )}
                  {debt.installment_count && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Número de Parcelas</p>
                      <p className="font-semibold">{debt.installment_count}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {debt.description && (
              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-2">Descrição</p>
                <p className="text-sm">{debt.description}</p>
              </div>
            )}

            {debt.notes && (
              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-2">Notas</p>
                <p className="text-sm">{debt.notes}</p>
              </div>
            )}
          </div>

          {debt.debt_payments && debt.debt_payments.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Histórico de Pagamentos</h3>
              <div className="space-y-3">
                {debt.debt_payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium">{formatCurrency(payment.amount_cents)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                      </p>
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{payment.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



