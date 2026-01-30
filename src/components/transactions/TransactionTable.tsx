'use client';

import { formatCurrencyValue } from '@/lib/utils';
import { parseDateOnly } from '@/lib/date';

export interface Transaction {
  id: string;
  description: string;
  amount: number | string;
  posted_at: string;
  account_id?: string;
  category_id?: string;
  notes?: string;
  accounts?: { name: string };
  categories?: { name: string; type: string };
  assigned_to?: string | null;
  assigned_to_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  // Extended fields
  source?: 'manual' | 'pluggy' | 'import';
  provider_tx_id?: string;
  recurrence_rule?: string;
  installment_number?: number;
  installment_total?: number;
}

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  sorting?: {
    sortBy: 'posted_at' | 'amount' | 'created_at';
    sortOrder: 'asc' | 'desc';
  };
  onSortChange?: (sorting: { sortBy: 'posted_at' | 'amount' | 'created_at'; sortOrder: 'asc' | 'desc' }) => void;
}

// Mobile Card Component for transactions
function MobileTransactionCard({ 
  tx, 
  onEdit, 
  onDelete, 
  formatCurrency, 
  formatDate 
}: { 
  tx: Transaction; 
  onEdit: (tx: Transaction) => void; 
  onDelete: (id: string) => void;
  formatCurrency: (value: number | string) => string;
  formatDate: (date: string) => string;
}) {
  const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
  const isIncome = amount > 0;

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header: Icon, Description, Amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isIncome ? 'bg-positive/10' : 'bg-negative/10'
            }`}
          >
            <i
              className={`bx text-xl ${isIncome ? 'bx-trending-up text-positive' : 'bx-trending-down text-negative'}`}
            ></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{tx.description}</p>
            <p className="text-xs text-muted-foreground">{formatDate(tx.posted_at)}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`font-semibold ${isIncome ? 'text-positive' : 'text-negative'}`}>
            {isIncome ? '+' : ''}{formatCurrency(amount)}
          </p>
        </div>
      </div>

      {/* Tags: Category, Account, Installment */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge-pill text-xs">
          {tx.categories?.name || 'Sem categoria'}
        </span>
        {tx.accounts?.name && (
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            {tx.accounts.name}
          </span>
        )}
        {tx.assigned_to_profile && (
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            {tx.assigned_to_profile.full_name || tx.assigned_to_profile.email}
          </span>
        )}
        {tx.installment_number && (
          <span className="badge-pill text-xs bg-purple-500/10 text-purple-500">
            {tx.installment_number}/{tx.installment_total}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/50">
        <button
          onClick={() => onEdit(tx)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
        >
          <i className='bx bx-edit'></i>
          <span>Editar</span>
        </button>
        <button
          onClick={() => onDelete(tx.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <i className='bx bx-trash'></i>
          <span>Excluir</span>
        </button>
      </div>
    </div>
  );
}

export default function TransactionTable({ 
  transactions, 
  onEdit, 
  onDelete,
  loading = false,
  sorting = { sortBy: 'created_at', sortOrder: 'desc' },
  onSortChange
}: TransactionTableProps) {
  // Helper para lidar com valores string ou number
  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return formatCurrencyValue(numValue);
  };

  const formatDate = (date: string) => {
    const parsed = parseDateOnly(date) || new Date(date);
    return parsed.toLocaleDateString('pt-BR');
  };

  const handleSort = (column: 'posted_at' | 'amount' | 'created_at') => {
    if (!onSortChange) return;
    
    if (sorting.sortBy === column) {
      // Toggle order if same column
      onSortChange({
        sortBy: column,
        sortOrder: sorting.sortOrder === 'asc' ? 'desc' : 'asc',
      });
    } else {
      // New column, default to desc
      onSortChange({
        sortBy: column,
        sortOrder: 'desc',
      });
    }
  };

  const SortIcon = ({ column }: { column: 'posted_at' | 'amount' | 'created_at' }) => {
    if (sorting.sortBy !== column) {
      return <i className='bx bx-sort text-muted-foreground/50'></i>;
    }
    return sorting.sortOrder === 'asc' 
      ? <i className='bx bx-sort-up text-primary'></i>
      : <i className='bx bx-sort-down text-primary'></i>;
  };

  if (loading) {
    return (
      <div className="glass-card p-6 md:p-8 text-center">
        <i className='bx bx-loader-alt bx-spin text-3xl md:text-4xl text-primary mb-4'></i>
        <p className="text-muted-foreground text-sm md:text-base">Carregando transações...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-card p-6 md:p-8 text-center">
        <i className='bx bx-inbox text-3xl md:text-4xl text-muted-foreground mb-4'></i>
        <p className="text-muted-foreground text-sm md:text-base">Nenhuma transação encontrada</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {/* Mobile Sort Controls */}
        {onSortChange && (
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-xs text-muted-foreground">Ordenar:</span>
            <button
              onClick={() => handleSort('posted_at')}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors ${
                sorting.sortBy === 'posted_at' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              Data <SortIcon column="posted_at" />
            </button>
            <button
              onClick={() => handleSort('amount')}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors ${
                sorting.sortBy === 'amount' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              Valor <SortIcon column="amount" />
            </button>
          </div>
        )}
        {transactions.map((tx) => (
          <MobileTransactionCard
            key={tx.id}
            tx={tx}
            onEdit={onEdit}
            onDelete={onDelete}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Categoria</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Conta</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Responsável</th>
                <th 
                  className={`text-left py-4 px-6 text-sm font-medium text-muted-foreground ${onSortChange ? 'cursor-pointer hover:text-foreground transition-colors select-none' : ''}`}
                  onClick={() => handleSort('posted_at')}
                >
                  <div className="flex items-center gap-2">
                    Data
                    {onSortChange && <SortIcon column="posted_at" />}
                  </div>
                </th>
                <th 
                  className={`text-right py-4 px-6 text-sm font-medium text-muted-foreground ${onSortChange ? 'cursor-pointer hover:text-foreground transition-colors select-none' : ''}`}
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Valor
                    {onSortChange && <SortIcon column="amount" />}
                  </div>
                </th>
                <th className="text-center py-4 px-6 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                const isIncome = amount > 0;
                
                return (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isIncome ? 'bg-positive/10' : 'bg-negative/10'
                          }`}
                        >
                          <i
                            className={`bx ${isIncome ? 'bx-trending-up text-positive' : 'bx-trending-down text-negative'}`}
                          ></i>
                        </div>
                        <div>
                          <span className="font-medium">{tx.description}</span>
                          {tx.installment_number && (
                            <div className="flex gap-2 mt-1">
                              <span className="badge-pill text-xs bg-purple-500/10 text-purple-500">
                                Parcela {tx.installment_number}/{tx.installment_total}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="badge-pill text-xs">
                        {tx.categories?.name || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">
                      {tx.accounts?.name || 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">
                      {tx.assigned_to_profile ? (
                        <span className="flex items-center gap-2">
                          {tx.assigned_to_profile.avatar_url && (
                            <img 
                              src={tx.assigned_to_profile.avatar_url} 
                              alt={tx.assigned_to_profile.full_name || tx.assigned_to_profile.email}
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <span>{tx.assigned_to_profile.full_name || tx.assigned_to_profile.email}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">
                      {formatDate(tx.posted_at)}
                    </td>
                    <td
                      className={`py-4 px-6 text-right font-medium ${
                        isIncome ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {isIncome ? '+' : ''}{formatCurrency(amount)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onEdit(tx)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <i className='bx bx-edit text-lg'></i>
                        </button>
                        <button
                          onClick={() => onDelete(tx.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir"
                        >
                          <i className='bx bx-trash text-lg'></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

