'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useMembers } from '@/hooks/useMembers';
import { formatCurrency } from '@/lib/utils';

interface Receivable {
  id: string;
  name: string;
  description?: string;
  debtor_name?: string;
  total_amount_cents: number;
  received_amount_cents: number;
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
  include_in_plan?: boolean;
  plan_entries?: Array<{ entry_month: string; amount_cents: number; description?: string | null }>;
  receivable_payments?: Array<{
    id: string;
    amount_cents: number;
    payment_date: string;
    notes?: string;
  }>;
}

export default function ReceivableDetailPage() {
  const router = useRouter();
  const params = useParams();
  const receivableId = params?.id as string;
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { members, loading: loadingMembers } = useMembers();

  const [loading, setLoading] = useState(true);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [receivable, setReceivable] = useState<Receivable | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
    contribution_count: '',
    start_date: '',
  });
  const [useCustomPlan, setUseCustomPlan] = useState(false);
  const [planEntries, setPlanEntries] = useState<Array<{ month: string; amount: string }>>([
    { month: '', amount: '' },
  ]);

  useEffect(() => {
    if (receivableId) {
      fetchReceivable();
    }
  }, [receivableId]);

  const fetchReceivable = async () => {
    try {
      const response = await fetch(`/api/receivables/${receivableId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/app/receivables');
          return;
        }
        throw new Error('Erro ao carregar recebível');
      }
      const result = await response.json();
      const receivableData = result.data;
      setReceivable(receivableData);
      
      // Populate form data
      setFormData({
        name: receivableData.name || '',
        description: receivableData.description || '',
        debtor_name: receivableData.debtor_name || '',
        total_amount_cents: (receivableData.total_amount_cents / 100).toFixed(2),
        received_amount_cents: (receivableData.received_amount_cents / 100).toFixed(2),
        interest_rate: receivableData.interest_rate?.toString() || '0',
        due_date: receivableData.due_date || '',
        status: receivableData.status || 'pendente',
        priority: receivableData.priority || 'medium',
        notes: receivableData.notes || '',
        payment_frequency: receivableData.payment_frequency || '',
        payment_amount_cents: receivableData.payment_amount_cents ? (receivableData.payment_amount_cents / 100).toFixed(2) : '',
        installment_count: receivableData.installment_count?.toString() || '',
        include_in_plan: receivableData.include_in_plan ?? false,
        contribution_frequency: receivableData.contribution_frequency || 'monthly',
        monthly_payment_cents: receivableData.monthly_payment_cents ? (receivableData.monthly_payment_cents / 100).toFixed(2) : '',
        contribution_count: receivableData.contribution_count?.toString() || '',
        start_date: receivableData.start_date || '',
      });
      setAssignedTo(receivableData.assigned_to || '');
      if (receivableData.plan_entries && receivableData.plan_entries.length > 0) {
        setUseCustomPlan(true);
        setPlanEntries(
          receivableData.plan_entries.map((entry: any) => ({
            month: entry.entry_month?.slice(0, 7),
            amount: ((entry.amount_cents || 0) / 100).toString(),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching receivable:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar recebível",
        description: "Ocorreu um erro ao tentar carregar os dados do recebível",
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
            setFormData({
              ...formData,
              total_amount_cents: (totalFromInstallments / 100).toFixed(2),
            });
            // Update the form data and continue
            const updatedFormData = {
              ...formData,
              total_amount_cents: (totalFromInstallments / 100).toFixed(2),
            };
            await saveReceivable(updatedFormData, cleanedPlanEntries);
            return;
          }
        }
      }

      await saveReceivable(formData, cleanedPlanEntries);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar recebível",
        description: error.message || "Ocorreu um erro ao tentar salvar o recebível",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveReceivable = async (
    data: typeof formData,
    cleanedPlanEntries: Array<{ month: string; amount: number }>
  ) => {
    const response = await fetch(`/api/receivables/${receivableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        debtor_name: data.debtor_name || undefined,
        total_amount_cents: Math.round(parseFloat(data.total_amount_cents) * 100),
        received_amount_cents: Math.round(parseFloat(data.received_amount_cents || '0') * 100),
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
        contribution_frequency: !useCustomPlan && data.include_in_plan && data.contribution_frequency
          ? data.contribution_frequency
          : undefined,
        monthly_payment_cents: !useCustomPlan && data.include_in_plan && data.monthly_payment_cents
          ? Math.round(parseFloat(data.monthly_payment_cents) * 100)
          : undefined,
        contribution_count: !useCustomPlan && data.include_in_plan && data.contribution_count
          ? parseInt(data.contribution_count)
          : undefined,
        start_date: !useCustomPlan && data.include_in_plan && data.start_date
          ? data.start_date
          : undefined,
        plan_entries: useCustomPlan
          ? cleanedPlanEntries.map((entry) => ({
              month: entry.month,
              amount_cents: Math.round(entry.amount * 100),
            }))
          : [],
        assigned_to: assignedTo || undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao salvar recebível');
    }

    setIsEditing(false);
    fetchReceivable();
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

  if (!receivable) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/receivables" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl md:text-3xl font-bold">{receivable.name}</h1>
          <p className="text-muted-foreground">Detalhes e edição do recebível</p>
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
              <label className="block text-sm font-medium mb-2">Nome do Recebível *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              <label className="block text-sm font-medium mb-2">Valor Já Recebido (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.received_amount_cents}
                onChange={(e) => setFormData({ ...formData, received_amount_cents: e.target.value })}
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

                  <div>
                    <label className="block text-sm font-medium mb-2">Número de Recebimentos</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.contribution_count}
                      onChange={(e) => setFormData({ ...formData, contribution_count: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Deixe vazio para contínuo"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantidade total de recebimentos. Deixe vazio para recebimentos contínuos.
                    </p>
                  </div>
                </>
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

          {/* Responsible Person */}
          {members.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2">Responsável</label>
              <Select
                value={assignedTo}
                onValueChange={setAssignedTo}
                disabled={loadingMembers}
              >
                <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName || 'Avatar'}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                            {(member.fullName || member.email)[0].toUpperCase()}
                          </div>
                        )}
                        <span>{member.fullName || member.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Quem é responsável por este recebível?
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                fetchReceivable();
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
                <p className="font-semibold">{getStatusLabel(receivable.status)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Prioridade</p>
                <p className="font-semibold capitalize">{receivable.priority}</p>
              </div>
              {receivable.due_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vencimento</p>
                  <p className="font-semibold">{new Date(receivable.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(receivable.total_amount_cents)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Recebido</p>
                  <p className="text-2xl font-bold text-green-500">{formatCurrency(receivable.received_amount_cents)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Restante</p>
                  <p className="text-2xl font-bold text-orange-500">{formatCurrency(receivable.remaining_amount_cents)}</p>
                </div>
              </div>
            </div>

            {receivable.status === 'negociada' && (receivable.payment_frequency || receivable.payment_amount_cents || receivable.installment_count) && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Informações de Negociação</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  {receivable.payment_frequency && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Frequência</p>
                      <p className="font-semibold">
                        {receivable.payment_frequency === 'daily' ? 'Diário' :
                         receivable.payment_frequency === 'weekly' ? 'Semanal' :
                         receivable.payment_frequency === 'biweekly' ? 'Quinzenal' :
                         receivable.payment_frequency === 'monthly' ? 'Mensal' :
                         receivable.payment_frequency === 'quarterly' ? 'Trimestral' :
                         receivable.payment_frequency === 'yearly' ? 'Anual' : receivable.payment_frequency}
                      </p>
                    </div>
                  )}
                  {receivable.payment_amount_cents && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Valor por Parcela</p>
                      <p className="font-semibold">{formatCurrency(receivable.payment_amount_cents)}</p>
                    </div>
                  )}
                  {receivable.installment_count && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Número de Parcelas</p>
                      <p className="font-semibold">{receivable.installment_count}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {receivable.description && (
              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-2">Descrição</p>
                <p className="text-sm">{receivable.description}</p>
              </div>
            )}

            {receivable.notes && (
              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-2">Notas</p>
                <p className="text-sm">{receivable.notes}</p>
              </div>
            )}
          </div>

          {receivable.receivable_payments && receivable.receivable_payments.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Histórico de Recebimentos</h3>
              <div className="space-y-3">
                {receivable.receivable_payments.map((payment) => (
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

      {/* Adjust Value Confirmation Dialog */}
      {ConfirmDialog}
    </div>
  );
}
