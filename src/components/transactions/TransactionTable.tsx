'use client';

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
  // Extended fields
  source?: 'manual' | 'pluggy' | 'import';
  provider_tx_id?: string;
  is_recurring?: boolean;
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
    sortBy: 'posted_at' | 'amount';
    sortOrder: 'asc' | 'desc';
  };
  onSortChange?: (sorting: { sortBy: 'posted_at' | 'amount'; sortOrder: 'asc' | 'desc' }) => void;
}

export default function TransactionTable({ 
  transactions, 
  onEdit, 
  onDelete,
  loading = false,
  sorting = { sortBy: 'posted_at', sortOrder: 'desc' },
  onSortChange
}: TransactionTableProps) {
  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const handleSort = (column: 'posted_at' | 'amount') => {
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

  const SortIcon = ({ column }: { column: 'posted_at' | 'amount' }) => {
    if (sorting.sortBy !== column) {
      return <i className='bx bx-sort text-muted-foreground/50'></i>;
    }
    return sorting.sortOrder === 'asc' 
      ? <i className='bx bx-sort-up text-primary'></i>
      : <i className='bx bx-sort-down text-primary'></i>;
  };

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <i className='bx bx-loader-alt bx-spin text-4xl text-primary mb-4'></i>
        <p className="text-muted-foreground">Carregando transações...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <i className='bx bx-inbox text-4xl text-muted-foreground mb-4'></i>
        <p className="text-muted-foreground">Nenhuma transação encontrada</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Descrição</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Categoria</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Conta</th>
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
                          isIncome ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}
                      >
                        <i
                          className={`bx ${isIncome ? 'bx-trending-up text-green-500' : 'bx-trending-down text-red-500'}`}
                        ></i>
                      </div>
                      <div>
                        <span className="font-medium">{tx.description}</span>
                        {(tx.is_recurring || tx.installment_number) && (
                          <div className="flex gap-2 mt-1">
                            {tx.is_recurring && (
                              <span className="badge-pill text-xs bg-blue-500/10 text-blue-500">
                                <i className='bx bx-repeat'></i> Recorrente
                              </span>
                            )}
                            {tx.installment_number && (
                              <span className="badge-pill text-xs bg-purple-500/10 text-purple-500">
                                Parcela {tx.installment_number}/{tx.installment_total}
                              </span>
                            )}
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
                    {formatDate(tx.posted_at)}
                  </td>
                  <td
                    className={`py-4 px-6 text-right font-medium ${
                      isIncome ? 'text-green-500' : 'text-red-500'
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
  );
}

