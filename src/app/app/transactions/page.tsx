'use client';

import { useState, useEffect } from 'react';
import TransactionFilters, { FilterState } from '@/components/transactions/TransactionFilters';
import TransactionTable, { Transaction as TransactionTableType } from '@/components/transactions/TransactionTable';
import TransactionForm, { Transaction as TransactionFormType } from '@/components/transactions/TransactionForm';
import ImportModal from '@/components/transactions/ImportModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionTableType[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    accountId: '',
    categoryId: '',
    type: '',
    fromDate: '',
    toDate: '',
  });
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50,
    count: 0,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionFormType | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters, pagination.offset]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
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
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      
      setTransactions(data.data || []);
      setPagination(prev => ({ ...prev, count: data.count || 0 }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as transações',
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

      toast({
        title: 'Sucesso',
        description: 'Transação criada com sucesso',
      });

      fetchTransactions();
      setFormOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

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
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) {
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
        title: 'Erro',
        description: error.message,
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

  const totalPages = Math.ceil(pagination.count / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Transações</h1>
          <p className="text-muted-foreground">Gerencie suas receitas e despesas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleImportCSV} variant="outline">
            <i className='bx bx-upload'></i>
            Importar
          </Button>
          <Button onClick={handleNewTransaction} className="btn-primary">
            <i className='bx bx-plus'></i>
            Nova Transação
          </Button>
        </div>
      </div>

      <TransactionFilters
        onFiltersChange={setFilters}
        accounts={accounts}
        categories={categories}
      />

      <TransactionTable
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDeleteTransaction}
        loading={loading}
      />

      {pagination.count > 0 && (
        <div className="flex items-center justify-between glass-card p-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.count)} de {pagination.count} transações
          </p>
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
        categories={categories}
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
    </div>
  );
}
