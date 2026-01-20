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

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currency: string;
  current_balance: number;
  color?: string;
  icon?: string;
  is_default?: boolean;
  overdraft_limit_cents?: number;
  overdraft_interest_rate_monthly?: number;
  yield_type?: 'fixed' | 'cdi_percentage';
  yield_rate_monthly?: number;
  cdi_percentage?: number;
}

interface CdiRateInfo {
  daily_rate: number;
  monthly_rate: number;
  annual_rate: number;
  date: string;
}

const accountTypes = [
  { value: 'checking', label: 'Conta Corrente', icon: '🏦' },
  { value: 'savings', label: 'Poupança', icon: '💰' },
  { value: 'credit', label: 'Cartão de Crédito', icon: '💳' },
  { value: 'investment', label: 'Investimento', icon: '📈' },
];

const accountColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const accountIcons = [
  '🏦', '💰', '💳', '📈', '🏠', '🚗', '💼', '🎯', '⭐', '💎',
  '🔐', '💡', '📊', '🎨', '🌟', '⚡', '🔥', '💫', '🎁', '📱',
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    institution: '',
    currency: 'BRL',
    current_balance: '',
    color: '#3b82f6',
    icon: '🏦',
    has_overdraft: false,
    overdraft_limit: '',
    overdraft_interest_rate: '',
    has_yield: false,
    yield_type: 'fixed' as 'fixed' | 'cdi_percentage',
    yield_rate: '',
    cdi_percentage: '',
  });
  const [cdiRate, setCdiRate] = useState<CdiRateInfo | null>(null);
  const [loadingCdi, setLoadingCdi] = useState(false);
  const { toast } = useToast();

  // Fetch CDI rate when dialog opens with yield enabled
  const fetchCdiRate = async () => {
    if (loadingCdi) return;
    setLoadingCdi(true);
    try {
      const res = await fetch('/api/cdi');
      if (res.ok) {
        const data = await res.json();
        setCdiRate(data);
      }
    } catch (error) {
      console.error('Error fetching CDI rate:', error);
    } finally {
      setLoadingCdi(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch CDI rate when dialog opens
  useEffect(() => {
    if (dialogOpen && formData.has_yield && !cdiRate) {
      fetchCdiRate();
    }
  }, [dialogOpen, formData.has_yield]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Falha ao carregar contas',
        description: 'Não foi possível carregar as contas. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'O nome da conta é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingAccount
        ? `/api/accounts/${editingAccount.id}`
        : '/api/accounts';
      const method = editingAccount ? 'PATCH' : 'POST';

      const body: any = {
        name: formData.name.trim(),
        type: formData.type,
        institution: formData.institution.trim() || null,
        currency: formData.currency,
        balance_cents: Math.round(parseFloat(formData.current_balance || '0') * 100),
        color: formData.color,
        icon: formData.icon,
      };

      // Add overdraft fields if enabled
      if (formData.has_overdraft) {
        body.overdraft_limit_cents = Math.round(parseFloat(formData.overdraft_limit || '0') * 100);
        // Parse with comma support for Brazilian format
        const interestValue = formData.overdraft_interest_rate.replace(',', '.');
        body.overdraft_interest_rate_monthly = parseFloat(interestValue || '0');
      } else {
        body.overdraft_limit_cents = 0;
        body.overdraft_interest_rate_monthly = 0;
      }

      // Add yield fields if enabled
      if (formData.has_yield) {
        body.yield_type = formData.yield_type;
        if (formData.yield_type === 'fixed') {
          // Parse with comma support for Brazilian format
          const yieldValue = formData.yield_rate.replace(',', '.');
          body.yield_rate_monthly = parseFloat(yieldValue || '0');
          body.cdi_percentage = null;
        } else {
          // CDI percentage
          body.yield_rate_monthly = 0;
          body.cdi_percentage = parseFloat(formData.cdi_percentage || '0');
        }
      } else {
        body.yield_type = 'fixed';
        body.yield_rate_monthly = 0;
        body.cdi_percentage = null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao salvar conta');
      }

      toast({
        title: 'Sucesso',
        description: editingAccount ? 'Conta atualizada' : 'Conta criada',
      });

      fetchAccounts();
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
    if (!accountToDelete) return;

    try {
      const res = await fetch(`/api/accounts/${accountToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao excluir conta');
      }

      toast({
        title: 'Sucesso',
        description: 'Conta excluída',
      });

      fetchAccounts();
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    const hasYield = account.yield_type === 'cdi_percentage'
      ? (account.cdi_percentage || 0) > 0
      : (account.yield_rate_monthly || 0) > 0;
    setFormData({
      name: account.name,
      type: account.type,
      institution: account.institution || '',
      currency: account.currency,
      current_balance: account.current_balance.toString(),
      color: account.color || '#3b82f6',
      icon: account.icon || '🏦',
      has_overdraft: (account.overdraft_limit_cents || 0) > 0,
      overdraft_limit: account.overdraft_limit_cents ? (account.overdraft_limit_cents / 100).toFixed(2) : '',
      overdraft_interest_rate: account.overdraft_interest_rate_monthly ? account.overdraft_interest_rate_monthly.toString() : '',
      has_yield: hasYield,
      yield_type: account.yield_type || 'fixed',
      yield_rate: account.yield_rate_monthly ? account.yield_rate_monthly.toString().replace('.', ',') : '',
      cdi_percentage: account.cdi_percentage ? account.cdi_percentage.toString() : '',
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      type: 'checking',
      institution: '',
      currency: 'BRL',
      current_balance: '',
      color: '#3b82f6',
      icon: '🏦',
      has_overdraft: false,
      overdraft_limit: '',
      overdraft_interest_rate: '',
      has_yield: false,
      yield_type: 'fixed',
      yield_rate: '',
      cdi_percentage: '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || account.type === filterType;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-full">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-2xl md:text-3xl font-bold">Contas</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Gerencie suas contas bancárias e cartões</p>
        </div>
        <Button onClick={openNewDialog} className="btn-primary w-full sm:w-auto flex-shrink-0">
          <i className='bx bx-plus mr-2'></i>
          <span className="hidden sm:inline">Nova Conta</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-full">
          <div className="flex-1 relative min-w-0">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <Input
              placeholder="Buscar contas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full max-w-full"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm sm:text-base flex-shrink-0 w-full sm:w-auto"
          >
            <option value="all">Todos os tipos</option>
            {accountTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <i className='bx bx-loader-alt bx-spin text-4xl text-primary'></i>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-full">
          <i className='bx bx-wallet text-6xl text-muted-foreground mb-4'></i>
          <h3 className="text-lg font-medium mb-2">Nenhuma conta encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando sua primeira conta'}
          </p>
          {!searchTerm && (
            <Button onClick={openNewDialog}>
              <i className='bx bx-plus mr-2'></i>
              Adicionar Conta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-full">
          {filteredAccounts.map((account) => (
            <div key={account.id} className="glass-card p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: (account.color || '#3b82f6') + '20' }}
                  >
                    {account.icon || '🏦'}
                  </div>
                  <div>
                    <h3 className="font-semibold">{account.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {account.institution || accountTypes.find(t => t.value === account.type)?.label}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditDialog(account)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <i className='bx bx-edit text-lg'></i>
                  </button>
                  <button
                    onClick={() => {
                      setAccountToDelete(account);
                      setDeleteDialogOpen(true);
                    }}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                  >
                    <i className='bx bx-trash text-lg'></i>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                    {accountTypes.find(t => t.value === account.type)?.label || account.type}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo</span>
                  <span className={`font-semibold ${account.current_balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(account.current_balance)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Modifique os dados da conta' : 'Adicione uma nova conta bancária'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da conta"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              >
                {accountTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Instituição</label>
              <Input
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="Nome do banco"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Saldo Atual</label>
              <Input
                type="number"
                step="0.01"
                value={formData.current_balance}
                onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                placeholder="0,00"
              />
            </div>

            {/* Cheque Especial */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_overdraft"
                  checked={formData.has_overdraft}
                  onChange={(e) => setFormData({ ...formData, has_overdraft: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="has_overdraft" className="text-sm font-medium">
                  Possui limite de cheque especial?
                </label>
              </div>
              {formData.has_overdraft && (
                <div className="space-y-2 pl-6">
                  <div>
                    <label className="text-sm font-medium">Limite de Cheque Especial (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.overdraft_limit}
                      onChange={(e) => setFormData({ ...formData, overdraft_limit: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Taxa de Juros Mensal (%)</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.overdraft_interest_rate}
                      onChange={(e) => {
                        // Allow comma or dot as decimal separator
                        const value = e.target.value.replace(/[^0-9.,]/g, '');
                        setFormData({ ...formData, overdraft_interest_rate: value });
                      }}
                      placeholder="5,50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      <i className='bx bx-info-circle mr-1'></i>
                      Taxa de juros aplicada sobre o saldo negativo. Use <strong>vírgula</strong> como separador decimal (ex: 5,5 para 5,5% ao mês).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Rendimento */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_yield"
                  checked={formData.has_yield}
                  onChange={(e) => setFormData({ ...formData, has_yield: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="has_yield" className="text-sm font-medium">
                  Conta possui rendimento
                </label>
              </div>
              {formData.has_yield && (
                <div className="pl-6 space-y-4">
                  {/* Tipo de Rendimento */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de Rendimento</label>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="yield_type"
                          value="fixed"
                          checked={formData.yield_type === 'fixed'}
                          onChange={() => setFormData({ ...formData, yield_type: 'fixed' })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Taxa Fixa Mensal</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="yield_type"
                          value="cdi_percentage"
                          checked={formData.yield_type === 'cdi_percentage'}
                          onChange={() => setFormData({ ...formData, yield_type: 'cdi_percentage' })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">% do CDI</span>
                      </label>
                    </div>
                  </div>

                  {/* Taxa Fixa */}
                  {formData.yield_type === 'fixed' && (
                    <div>
                      <label className="text-sm font-medium">Taxa de Rendimento Mensal (%)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formData.yield_rate}
                        onChange={(e) => {
                          // Allow comma or dot as decimal separator
                          const value = e.target.value.replace(/[^0-9.,]/g, '');
                          setFormData({ ...formData, yield_rate: value });
                        }}
                        placeholder="0,50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        <i className='bx bx-info-circle mr-1'></i>
                        Taxa de rendimento aplicada sobre o saldo positivo. Use <strong>vírgula</strong> como separador decimal (ex: 0,5 para 0,5% ao mês).
                      </p>
                    </div>
                  )}

                  {/* % do CDI */}
                  {formData.yield_type === 'cdi_percentage' && (
                    <div>
                      <label className="text-sm font-medium">Percentual do CDI (%)</label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="500"
                        value={formData.cdi_percentage}
                        onChange={(e) => setFormData({ ...formData, cdi_percentage: e.target.value })}
                        placeholder="100"
                      />
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs">
                        <div className="flex items-start gap-2">
                          <i className='bx bx-info-circle text-primary mt-0.5'></i>
                          <div className="space-y-1">
                            <p>
                              Os bancos divulgam o rendimento como percentual do CDI. Exemplos:
                            </p>
                            <ul className="list-disc list-inside pl-2 space-y-0.5 text-muted-foreground">
                              <li><strong>100%</strong> do CDI = rende igual ao CDI</li>
                              <li><strong>102%</strong> do CDI = rende 2% a mais que o CDI</li>
                              <li><strong>120%</strong> do CDI = rende 20% a mais que o CDI</li>
                            </ul>
                            {loadingCdi ? (
                              <p className="text-muted-foreground mt-2">
                                <i className='bx bx-loader-alt bx-spin mr-1'></i>
                                Buscando taxa CDI atual...
                              </p>
                            ) : cdiRate ? (
                              <div className="mt-2 pt-2 border-t border-border">
                                <p className="font-medium text-foreground">Taxa CDI atual ({cdiRate.date}):</p>
                                <p className="text-muted-foreground">
                                  {cdiRate.daily_rate.toFixed(6)}% ao dia ≈ {cdiRate.monthly_rate.toFixed(2)}% ao mês ≈ {cdiRate.annual_rate.toFixed(2)}% ao ano
                                </p>
                                {formData.cdi_percentage && parseFloat(formData.cdi_percentage) > 0 && (
                                  <p className="text-primary font-medium mt-1">
                                    Com {formData.cdi_percentage}% do CDI: ≈ {(cdiRate.monthly_rate * parseFloat(formData.cdi_percentage) / 100).toFixed(2)}% ao mês
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {accountColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
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
              <div className="flex flex-wrap gap-2 mt-2 max-h-24 overflow-y-auto">
                {accountIcons.map((icon) => (
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
              {editingAccount ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a conta "{accountToDelete?.name}"?
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
