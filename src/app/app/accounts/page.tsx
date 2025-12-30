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
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as contas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingAccount
        ? `/api/accounts/${editingAccount.id}`
        : '/api/accounts';
      const method = editingAccount ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          type: formData.type,
          institution: formData.institution.trim() || null,
          currency: formData.currency,
          balance_cents: Math.round(parseFloat(formData.current_balance || '0') * 100),
          color: formData.color,
          icon: formData.icon,
        }),
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
    setFormData({
      name: account.name,
      type: account.type,
      institution: account.institution || '',
      currency: account.currency,
      current_balance: account.current_balance.toString(),
      color: account.color || '#3b82f6',
      icon: account.icon || '🏦',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Contas</h1>
          <p className="text-muted-foreground">Gerencie suas contas bancárias e cartões</p>
        </div>
        <Button onClick={openNewDialog} className="btn-primary">
          <i className='bx bx-plus mr-2'></i>
          Nova Conta
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <Input
              placeholder="Buscar contas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background"
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
        <div className="glass-card p-12 text-center">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {accountColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
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
