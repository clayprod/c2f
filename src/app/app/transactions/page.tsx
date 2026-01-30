'use client';

import { useState, useEffect, useRef } from 'react';
import TransactionFilters, { FilterState } from '@/components/transactions/TransactionFilters';
import TransactionTable, { Transaction as TransactionTableType } from '@/components/transactions/TransactionTable';
import TransactionForm, { Transaction as TransactionFormType } from '@/components/transactions/TransactionForm';
import ImportModal from '@/components/transactions/ImportModal';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useMembers } from '@/hooks/useMembers';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useAccountContext } from '@/hooks/useAccountContext';
import { useRealtimeCashflowUpdates } from '@/hooks/useRealtimeCashflowUpdates';

interface Account {
  id: string;
  name: string;
  type?: string;
  icon?: string;
  color?: string;
  last_four_digits?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionTableType[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { members } = useMembers();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    accountId: '',
    categoryId: '',
    type: '',
    fromDate: '',
    toDate: '',
    isInstallment: 'all',
    assignedTo: '',
  });
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 10,
    count: 0,
  });
  const [sorting, setSorting] = useState({
    sortBy: 'created_at' as 'posted_at' | 'amount' | 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllData, setDeleteAllData] = useState<{
    transactions: number;
    dependencies: { table: string; name: string; count: number }[];
  } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<TransactionFormType | undefined>();
  const [createJobId, setCreateJobId] = useState<string | null>(null);
  const [createJobProgress, setCreateJobProgress] = useState<{ processed: number; total: number } | null>(null);
  const [creatingJob, setCreatingJob] = useState(false);
  const formDataRef = useRef<any>(null);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { context: accountContext, activeAccountId } = useAccountContext();
  const ownerId = activeAccountId || accountContext?.currentUserId || null;

  useEffect(() => {
    fetchAccounts();
    fetchCreditCards();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters, pagination.offset, pagination.limit, sorting]);

  useRealtimeCashflowUpdates({
    ownerId,
    onRefresh: () => {
      fetchTransactions();
      fetchAccounts();
      fetchCreditCards();
      fetchCategories();
    },
    tables: ['transactions', 'accounts', 'categories'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
  });

  // Reset offset when sorting changes
  const handleSortChange = (newSorting: { sortBy: 'posted_at' | 'amount' | 'created_at'; sortOrder: 'asc' | 'desc' }) => {
    setSorting(newSorting);
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchCreditCards = async () => {
    try {
      const res = await fetch('/api/credit-cards');
      const data = await res.json();
      setCreditCards(data.data || []);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.accountId) params.append('account_id', filters.accountId);
      if (filters.categoryId) params.append('category_id', filters.categoryId);
      if (filters.type) params.append('type', filters.type);
      if (filters.fromDate) params.append('from_date', filters.fromDate);
      if (filters.toDate) params.append('to_date', filters.toDate);
      if (filters.isInstallment && filters.isInstallment !== 'all') {
        params.append('is_installment', filters.isInstallment === 'installment' ? 'true' : 'false');
      }
      if (filters.assignedTo) {
        params.append('assigned_to', filters.assignedTo);
      }
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());
      params.append('sort_by', sorting.sortBy);
      params.append('sort_order', sorting.sortOrder);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      
      setTransactions(data.data || []);
      setPagination(prev => ({ ...prev, count: data.count || 0 }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Falha ao carregar transações',
        description: 'Não foi possível carregar as transações. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (formData: any) => {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar transação');
      }
      const data = await res.json();
      const jobId = data.job_id as string | undefined;
      if (!jobId) {
        throw new Error('Transação criada sem job_id');
      }

      formDataRef.current = formData;
      setCreateJobId(jobId);
      setCreateJobProgress({ processed: 0, total: 1 });
      setCreatingJob(true);
    } catch (error: any) {
      toast({
        title: 'Falha ao criar transação',
        description: error.message || 'Não foi possível criar a transação. Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!createJobId || !creatingJob) return;
    let interval: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${createJobId}`);
        const data = await res.json();
        if (!res.ok || !data.job) {
          throw new Error(data.error || 'Erro ao consultar status da transação');
        }

        const job = data.job;
        const processed = job.progress?.processed || 0;
        const total = job.progress?.total || 1;
        setCreateJobProgress({ processed, total });

        if (job.status === 'completed') {
          setCreatingJob(false);
          setCreateJobId(null);
          toast({
            title: 'Sucesso',
            description: 'Transação criada com sucesso',
          });

          setPagination(prev => ({ ...prev, offset: 0 }));
          const transactionDate = formDataRef.current?.posted_at || new Date().toISOString().split('T')[0];
          const needsFilterAdjustment =
            (filters.fromDate && transactionDate < filters.fromDate) ||
            (filters.toDate && transactionDate > filters.toDate);

          if (needsFilterAdjustment) {
            setFilters(prev => ({
              ...prev,
              fromDate: filters.fromDate && transactionDate < filters.fromDate ? transactionDate : prev.fromDate,
              toDate: filters.toDate && transactionDate > filters.toDate ? transactionDate : prev.toDate,
            }));
          }

          setFormOpen(false);
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          setCreatingJob(false);
          setCreateJobId(null);
          toast({
            title: 'Falha ao criar transação',
            description: job.error_summary || 'Erro ao criar transação',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        setCreatingJob(false);
        setCreateJobId(null);
        toast({
          title: 'Falha ao criar transação',
          description: error.message || 'Erro ao criar transação',
          variant: 'destructive',
        });
      }
    };

    interval = setInterval(poll, 2000);
    poll();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [createJobId, creatingJob, filters.fromDate, filters.toDate, toast]);

  const handleUpdateTransaction = async (formData: any) => {
    if (!editingTransaction) return;

    try {
      const res = await fetch(`/api/transactions/${editingTransaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao atualizar transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação atualizada com sucesso',
      });

      fetchTransactions();
      setFormOpen(false);
      setEditingTransaction(undefined);
    } catch (error: any) {
      toast({
        title: 'Falha ao atualizar transação',
        description: error.message || 'Não foi possível atualizar a transação. Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Transação',
      description: 'Tem certeza que deseja excluir esta transação?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao excluir transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação excluída com sucesso',
      });

      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Falha ao excluir transação',
        description: error.message || 'Não foi possível excluir a transação. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (transaction: TransactionTableType) => {
    setEditingTransaction({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      posted_at: transaction.posted_at,
      account_id: transaction.account_id,
      category_id: transaction.category_id,
      notes: transaction.notes,
    });
    setFormOpen(true);
  };

  const handleNewTransaction = () => {
    setEditingTransaction(undefined);
    setFormOpen(true);
  };

  const handleImportCSV = () => {
    setImportOpen(true);
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'transactions',
          startDate: filters.fromDate || undefined,
          endDate: filters.toDate || undefined,
          accountIds: filters.accountId ? [filters.accountId] : undefined,
          categoryIds: filters.categoryId ? [filters.categoryId] : undefined,
          search: filters.search || undefined,
          type: filters.type || undefined,
          isInstallment: filters.isInstallment === 'all'
            ? undefined
            : filters.isInstallment === 'installment',
          assignedTo: filters.assignedTo || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao exportar');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'transacoes.csv';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: 'Sucesso',
        description: 'Transações exportadas com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Falha ao exportar transações',
        description: error.message || 'Não foi possível exportar as transações. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAllTransactions = async () => {
    try {
      setDeletingAll(true);
      
      // Primeiro, verificar dependências
      const checkRes = await fetch('/api/transactions/bulk');
      const checkData = await checkRes.json();
      
      if (!checkRes.ok) {
        throw new Error(checkData.error || 'Erro ao verificar transações');
      }
      
      if (checkData.transactions === 0) {
        toast({
          title: 'Nenhuma transação',
          description: 'Não há transações para remover.',
        });
        return;
      }
      
      // Abrir diálogo com informações das dependências
      setDeleteAllData({
        transactions: checkData.transactions,
        dependencies: checkData.dependencies || [],
      });
      setDeleteAllDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Falha ao verificar transações',
        description: error.message || 'Não foi possível verificar as transações. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const confirmDeleteAllTransactions = async () => {
    try {
      setDeletingAll(true);
      const res = await fetch('/api/transactions/bulk', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao apagar transações');
      }

      toast({
        title: 'Sucesso',
        description: data.message || 'Todas as transações foram removidas',
      });

      setDeleteAllDialogOpen(false);
      setDeleteAllData(null);
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Falha ao apagar transações',
        description: error.message || 'Não foi possível apagar as transações. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const totalPages = Math.ceil(pagination.count / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Transações</h1>
          <p className="text-muted-foreground">Gerencie suas receitas e despesas</p>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mb-1">
          <Button onClick={handleImportCSV} variant="outline" className="flex-shrink-0">
            <i className='bx bx-file-plus mr-1 sm:mr-2'></i>
            <span className="hidden sm:inline">Importar</span>
            <span className="sm:hidden">Importar</span>
          </Button>
          <Button onClick={handleExportCSV} variant="outline" disabled={exporting} className="flex-shrink-0">
            <i className='bx bx-save mr-1 sm:mr-2'></i>
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
          <Button onClick={handleNewTransaction} className="btn-primary flex-shrink-0">
            <i className='bx bx-plus mr-1 sm:mr-2'></i>
            <span className="hidden sm:inline">Nova Transação</span>
            <span className="sm:hidden">Nova</span>
          </Button>
          {pagination.count > 0 && (
            <Button 
              onClick={handleDeleteAllTransactions} 
              variant="outline" 
              disabled={deletingAll}
              className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <i className='bx bx-trash mr-1 sm:mr-2'></i>
              <span className="hidden sm:inline">Apagar Todas</span>
              <span className="sm:hidden">Apagar</span>
            </Button>
          )}
        </div>
      </div>

      <TransactionFilters
        onFiltersChange={setFilters}
        accounts={[
          ...accounts,
          ...creditCards.map(card => ({ ...card, type: 'credit_card' as const }))
        ]}
        categories={categories}
        members={members}
      />

      <TransactionTable
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDeleteTransaction}
        loading={loading}
        sorting={sorting}
        onSortChange={handleSortChange}
      />

      {pagination.count > 0 && (
        <div className="glass-card p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.count)} de {pagination.count} transações
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="items-per-page" className="text-sm text-muted-foreground">
                  Itens por página:
                </label>
                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(value) => {
                    setPagination(prev => ({ ...prev, limit: parseInt(value), offset: 0 }));
                  }}
                >
                  <SelectTrigger id="items-per-page" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                >
                  Anterior
                </Button>
                <span className="px-4 py-2 text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={pagination.offset + pagination.limit >= pagination.count}
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTransaction(undefined);
        }}
        onSubmit={editingTransaction ? handleUpdateTransaction : handleCreateTransaction}
        transaction={editingTransaction}
        accounts={accounts}
        creditCards={creditCards}
        categories={categories}
        jobProgress={createJobProgress}
        jobRunning={creatingJob}
      />

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          fetchTransactions();
          setImportOpen(false);
        }}
        accounts={accounts}
      />

      {/* Delete Confirmation Dialog */}
      {ConfirmDialog}

      {/* Delete All Transactions Dialog */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive">Apagar Todas as Transações</DialogTitle>
            <DialogDescription>
              Você está prestes a apagar <strong>{deleteAllData?.transactions || 0} transações</strong>.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {deleteAllData && deleteAllData.dependencies.length > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="font-medium text-amber-700 mb-2">
                <i className='bx bx-info-circle mr-2'></i>
                Os seguintes itens também serão removidos:
              </p>
              <ul className="space-y-1 text-sm">
                {deleteAllData.dependencies.map((dep) => (
                  <li key={dep.table} className="flex items-center gap-2">
                    <i className='bx bx-chevron-right text-amber-600'></i>
                    <span>{dep.name}: <strong>{dep.count}</strong></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAllDialogOpen(false);
                setDeleteAllData(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAllTransactions}
              disabled={deletingAll}
              className="w-full sm:w-auto"
            >
              {deletingAll ? (
                <>
                  <i className='bx bx-loader-alt bx-spin mr-2'></i>
                  Apagando...
                </>
              ) : (
                <>
                  <i className='bx bx-trash mr-2'></i>
                  Apagar Todas ({deleteAllData?.transactions || 0})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
