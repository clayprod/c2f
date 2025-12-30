'use client';

import { useState, useEffect } from 'react';

interface TransactionFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
}

export interface FilterState {
  search: string;
  accountId: string;
  categoryId: string;
  type: string;
  fromDate: string;
  toDate: string;
}

export default function TransactionFilters({ 
  onFiltersChange, 
  accounts, 
  categories 
}: TransactionFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    accountId: '',
    categoryId: '',
    type: '',
    fromDate: '',
    toDate: '',
  });

  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Debounce search
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(() => {
      onFiltersChange(filters);
    }, 300);

    setSearchDebounce(timeout);

    return () => {
      if (searchDebounce) clearTimeout(searchDebounce);
    };
  }, [filters]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      accountId: '',
      categoryId: '',
      type: '',
      fromDate: '',
      toDate: '',
    });
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <input
              type="text"
              placeholder="Buscar transação..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        <select
          value={filters.accountId}
          onChange={(e) => handleFilterChange('accountId', e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[150px]"
        >
          <option value="">Todas as contas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        <select
          value={filters.categoryId}
          onChange={(e) => handleFilterChange('categoryId', e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[150px]"
        >
          <option value="">Todas categorias</option>
          <optgroup label="Receitas">
            {incomeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Despesas">
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
        </select>

        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[120px]"
        >
          <option value="">Todos tipos</option>
          <option value="income">Receita</option>
          <option value="expense">Despesa</option>
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => handleFilterChange('fromDate', e.target.value)}
          placeholder="Data inicial"
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[150px]"
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => handleFilterChange('toDate', e.target.value)}
          placeholder="Data final"
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[150px]"
        />

        {(filters.search || filters.accountId || filters.categoryId || filters.type || filters.fromDate || filters.toDate) && (
          <button
            onClick={clearFilters}
            className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-sm"
          >
            <i className='bx bx-x'></i> Limpar
          </button>
        )}
      </div>
    </div>
  );
}


