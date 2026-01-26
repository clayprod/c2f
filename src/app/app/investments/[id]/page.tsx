'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMembers } from '@/hooks/useMembers';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatCurrency } from '@/lib/utils';
import { useAccountContext } from '@/hooks/useAccountContext';
import { useRealtimeCashflowUpdates } from '@/hooks/useRealtimeCashflowUpdates';

interface Investment {
  id: string;
  name: string;
  type: string;
  institution?: string;
  initial_investment_cents: number;
  current_value_cents: number;
  purchase_date: string;
  sale_date?: string;
  quantity?: number;
  unit_price_cents?: number;
  status: string;
  notes?: string;
  include_in_plan?: boolean;
  contribution_frequency?: string;
  monthly_contribution_cents?: number;
  plan_entries?: Array<{ entry_month: string; amount_cents: number; description?: string | null }>;
  investment_transactions?: Array<{
    id: string;
    amount_cents: number;
    transaction_date: string;
    type: string;
    notes?: string;
  }>;
}

export default function InvestmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const investmentId = params?.id as string;
  const { toast } = useToast();
  const { members, loading: loadingMembers } = useMembers();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { context: accountContext, activeAccountId } = useAccountContext();
  const ownerId = activeAccountId || accountContext?.currentUserId || null;

  const [loading, setLoading] = useState(true);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'stocks',
    institution: '',
    initial_investment_cents: '',
    current_value_cents: '',
    purchase_date: '',
    quantity: '',
    unit_price_cents: '',
    status: 'active',
    notes: '',
    include_in_plan: true,
    contribution_frequency: 'monthly',
    monthly_contribution_cents: '',
    contribution_count: '',
    start_date: '',
  });
  const [useCustomPlan, setUseCustomPlan] = useState(false);
  const [planEntries, setPlanEntries] = useState<Array<{ month: string; amount: string }>>([
    { month: '', amount: '' },
  ]);

  useEffect(() => {
    if (investmentId) {
      fetchInvestment();
    }
  }, [investmentId]);

  useRealtimeCashflowUpdates({
    ownerId,
    onRefresh: () => {
      fetchInvestment();
    },
    tables: ['investments', 'investment_transactions'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
  });

  const fetchInvestment = async () => {
    try {
      const response = await fetch(`/api/investments/${investmentId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/app/investments');
          return;
        }
        throw new Error('Erro ao carregar investimento');
      }
      const result = await response.json();
      const investmentData = result.data;
      setInvestment(investmentData);
      
      // Populate form data
      setFormData({
        name: investmentData.name || '',
        type: investmentData.type || 'stocks',
        institution: investmentData.institution || '',
        initial_investment_cents: (investmentData.initial_investment_cents / 100).toFixed(2),
        current_value_cents: investmentData.current_value_cents 
          ? (investmentData.current_value_cents / 100).toFixed(2) 
          : '',
        purchase_date: investmentData.purchase_date || '',
        quantity: investmentData.quantity?.toString() || '',
        unit_price_cents: investmentData.unit_price_cents 
          ? (investmentData.unit_price_cents / 100).toFixed(2) 
          : '',
        status: investmentData.status || 'active',
        notes: investmentData.notes || '',
        include_in_plan: investmentData.include_in_plan ?? true,
        contribution_frequency: investmentData.contribution_frequency || 'monthly',
        monthly_contribution_cents: investmentData.monthly_contribution_cents 
          ? (investmentData.monthly_contribution_cents / 100).toFixed(2) 
          : '',
        contribution_count: investmentData.contribution_count?.toString() || '',
        start_date: investmentData.start_date || '',
      });
      setAssignedTo(investmentData.assigned_to || '');

      // Check for custom plan entries
      if (investmentData.plan_entries && investmentData.plan_entries.length > 0) {
        setUseCustomPlan(true);
        setPlanEntries(
          investmentData.plan_entries.map((entry: any) => ({
            month: entry.entry_month?.slice(0, 7),
            amount: ((entry.amount_cents || 0) / 100).toString(),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching investment:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar investimento",
        description: "Ocorreu um erro ao tentar carregar os dados do investimento",
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

      await saveInvestment(formData, cleanedPlanEntries);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar investimento",
        description: error.message || "Ocorreu um erro ao tentar salvar o investimento",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveInvestment = async (
    data: typeof formData,
    cleanedPlanEntries: Array<{ month: string; amount: number }>
  ) => {
    const response = await fetch(`/api/investments/${investmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        type: data.type,
        institution: data.institution || undefined,
        initial_investment_cents: Math.round(parseFloat(data.initial_investment_cents) * 100),
        current_value_cents: data.current_value_cents 
          ? Math.round(parseFloat(data.current_value_cents) * 100) 
          : undefined,
        purchase_date: data.purchase_date || undefined,
        quantity: data.quantity ? parseFloat(data.quantity) : undefined,
        unit_price_cents: data.unit_price_cents 
          ? Math.round(parseFloat(data.unit_price_cents) * 100) 
          : undefined,
        status: data.status,
        notes: data.notes || undefined,
        include_in_plan: data.include_in_plan || useCustomPlan,
        contribution_frequency: !useCustomPlan && data.include_in_plan && data.contribution_frequency
          ? data.contribution_frequency
          : undefined,
        monthly_contribution_cents: !useCustomPlan && data.monthly_contribution_cents
          ? Math.round(parseFloat(data.monthly_contribution_cents) * 100)
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
      throw new Error(error.error || 'Erro ao salvar investimento');
    }

    setIsEditing(false);
    fetchInvestment();
    toast({
      title: "Investimento atualizado",
      description: "As alterações foram salvas com sucesso.",
    });
  };

  const handleDeleteInvestment = async () => {
    if (!investment) return;

    const confirmed = await confirm({
      title: 'Excluir investimento',
      description: `Tem certeza que deseja excluir "${investment.name}"?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/investments/${investment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir investimento');
      }

      toast({
        title: 'Investimento excluído',
        description: 'O investimento foi removido com sucesso.',
      });

      router.push('/app/investments');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao excluir investimento',
        description: error.message || 'Não foi possível excluir o investimento. Tente novamente.',
      });
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stocks: 'Ações',
      bonds: 'Títulos',
      funds: 'Fundos',
      crypto: 'Criptomoedas',
      real_estate: 'Imóveis',
      other: 'Outros',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Ativo',
      sold: 'Vendido',
      matured: 'Vencido',
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

  if (!investment) {
    return null;
  }

  // Calculate gain/loss
  const currentValue = investment.current_value_cents || investment.initial_investment_cents;
  const gain = currentValue - investment.initial_investment_cents;
  const gainPercentage = investment.initial_investment_cents > 0 
    ? ((gain / investment.initial_investment_cents) * 100).toFixed(2) 
    : '0.00';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/investments" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl md:text-3xl font-bold">{investment.name}</h1>
          <p className="text-muted-foreground">Detalhes e edição do investimento</p>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={() => setIsEditing(true)} className="btn-primary">
              <i className='bx bx-edit'></i>
              Editar
            </button>
            <button
              onClick={handleDeleteInvestment}
              className="btn-secondary text-destructive hover:text-destructive"
              type="button"
            >
              <i className='bx bx-trash'></i>
              Excluir
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Nome do Investimento *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Data de Compra</label>
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
                Quem é responsável por este investimento?
              </p>
            </div>
          )}

          <div className="border-t pt-6 space-y-4">
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
                    Usar plano personalizado de aportes
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
                      <label className="block text-sm font-medium mb-2">Frequência de Aporte</label>
                      <Select
                        value={formData.contribution_frequency}
                        onValueChange={(value) => setFormData({ ...formData, contribution_frequency: value })}
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

                    <div>
                      <label className="block text-sm font-medium mb-2">Mês Inicial dos Aportes</label>
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
                        Mês em que se iniciam os aportes no orçamento
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Número de Aportes</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.contribution_count}
                        onChange={(e) => setFormData({ ...formData, contribution_count: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Deixe vazio para contínuo"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Quantidade total de aportes. Deixe vazio para aportes contínuos.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                fetchInvestment();
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
                <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                <p className="font-semibold">{getTypeLabel(investment.type)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <p className="font-semibold">{getStatusLabel(investment.status)}</p>
              </div>
              {investment.institution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Instituição</p>
                  <p className="font-semibold">{investment.institution}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Investido</p>
                  <p className="text-2xl font-bold">{formatCurrency(investment.initial_investment_cents)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Valor Atual</p>
                  <p className="text-2xl font-bold">{formatCurrency(currentValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ganho/Perda</p>
                  <p className={`text-2xl font-bold ${gain >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatCurrency(gain)} ({gain >= 0 ? '+' : ''}{gainPercentage}%)
                  </p>
                </div>
              </div>
            </div>

            {(investment.quantity || investment.unit_price_cents) && (
              <div className="border-t pt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {investment.quantity && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Quantidade</p>
                      <p className="font-semibold">{investment.quantity}</p>
                    </div>
                  )}
                  {investment.unit_price_cents && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Preço Unitário</p>
                      <p className="font-semibold">{formatCurrency(investment.unit_price_cents)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {investment.include_in_plan && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Configuração de Aportes</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {investment.plan_entries && investment.plan_entries.length > 0 ? (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-2">Plano Personalizado</p>
                      <div className="space-y-2">
                        {investment.plan_entries.map((entry, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <span className="font-medium">
                              {new Date(entry.entry_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </span>
                            <span className="font-semibold">{formatCurrency(entry.amount_cents)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {investment.contribution_frequency && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Frequência</p>
                          <p className="font-semibold">
                            {investment.contribution_frequency === 'daily' ? 'Diário' :
                             investment.contribution_frequency === 'weekly' ? 'Semanal' :
                             investment.contribution_frequency === 'biweekly' ? 'Quinzenal' :
                             investment.contribution_frequency === 'monthly' ? 'Mensal' :
                             investment.contribution_frequency === 'quarterly' ? 'Trimestral' :
                             investment.contribution_frequency === 'yearly' ? 'Anual' : investment.contribution_frequency}
                          </p>
                        </div>
                      )}
                      {investment.monthly_contribution_cents && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Valor Mensal do Aporte</p>
                          <p className="font-semibold">{formatCurrency(investment.monthly_contribution_cents)}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {investment.purchase_date && (
              <div className="border-t pt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data de Compra</p>
                    <p className="font-semibold">{new Date(investment.purchase_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  {investment.sale_date && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Data de Venda</p>
                      <p className="font-semibold">{new Date(investment.sale_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {investment.notes && (
              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-2">Notas</p>
                <p className="text-sm">{investment.notes}</p>
              </div>
            )}
          </div>

          {investment.investment_transactions && investment.investment_transactions.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Histórico de Transações</h3>
              <div className="space-y-3">
                {investment.investment_transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium">{formatCurrency(tx.amount_cents)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(tx.transaction_date).toLocaleDateString('pt-BR')} - {tx.type}
                      </p>
                      {tx.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{tx.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {ConfirmDialog}
    </div>
  );
}
