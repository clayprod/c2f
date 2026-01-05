'use client';

import { useState, useEffect } from 'react';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

interface TransactionFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string; source_type?: string | null }>;
}

export interface FilterState {
  search: string;
  accountId: string;
  categoryId: string;
  type: string;
  fromDate: string;
  toDate: string;
  isRecurring: string; // 'all', 'recurring', 'non-recurring'
  isInstallment: string; // 'all', 'installment', 'non-installment'
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
    isRecurring: 'all',
    isInstallment: 'all',
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

  const handleDateRangeChange = (start: string, end: string) => {
    setFilters(prev => ({ ...prev, fromDate: start, toDate: end }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      accountId: '',
      categoryId: '',
      type: '',
      fromDate: '',
      toDate: '',
      isRecurring: 'all',
      isInstallment: 'all',
    });
  };

  // Group categories by source_type
  const generalIncome = categories.filter(c => c.type === 'income' && (c.source_type === 'general' || !c.source_type));
  const generalExpense = categories.filter(c => c.type === 'expense' && (c.source_type === 'general' || !c.source_type));
  const creditCardCategories = categories.filter(c => c.source_type === 'credit_card');
  const investmentCategories = categories.filter(c => c.source_type === 'investment');
  const goalCategories = categories.filter(c => c.source_type === 'goal');
  const debtCategories = categories.filter(c => c.source_type === 'debt');

  // For backward compatibility
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const hasActiveFilters = filters.search || filters.accountId || filters.categoryId || filters.type || filters.fromDate || filters.toDate || filters.isRecurring !== 'all' || filters.isInstallment !== 'all';

  return (
    <div className="glass-card p-4 space-y-4">
      {/* First Row: Search and Basic Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
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
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
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
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
        >
          <option value="">Todas categorias</option>
          {generalIncome.length > 0 && (
            <optgroup label="Receitas">
              {generalIncome.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {generalExpense.length > 0 && (
            <optgroup label="Despesas">
              {generalExpense.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {creditCardCategories.length > 0 && (
            <optgroup label="💳 Cartões de Crédito">
              {creditCardCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {investmentCategories.length > 0 && (
            <optgroup label="📊 Investimentos">
              {investmentCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {goalCategories.length > 0 && (
            <optgroup label="🎯 Objetivos">
              {goalCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {debtCategories.length > 0 && (
            <optgroup label="💳 Dívidas">
              {debtCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
        >
          <option value="">Todos tipos</option>
          <option value="income">Receita</option>
          <option value="expense">Despesa</option>
        </select>
      </div>

      {/* Second Row: Advanced Filters and Date Range */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Recorrência:</label>
            <select
              value={filters.isRecurring}
              onChange={(e) => handleFilterChange('isRecurring', e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[140px]"
            >
              <option value="all">Todas</option>
              <option value="recurring">Recorrentes</option>
              <option value="non-recurring">Não recorrentes</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Parcelas:</label>
            <select
              value={filters.isInstallment}
              onChange={(e) => handleFilterChange('isInstallment', e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[140px]"
            >
              <option value="all">Todas</option>
              <option value="installment">Parceladas</option>
              <option value="non-installment">Não parceladas</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Período:</label>
            <DateRangeFilter
              startDate={filters.fromDate}
              endDate={filters.toDate}
              onDateChange={handleDateRangeChange}
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-sm whitespace-nowrap"
            >
              <i className='bx bx-x mr-1'></i> Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}




