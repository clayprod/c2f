'use client';

import { useState, useEffect } from 'react';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

interface Member {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

interface TransactionFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  accounts: Array<{ id: string; name: string; type?: string }>;
  categories: Array<{ id: string; name: string; type: string; source_type?: string | null }>;
  members?: Member[];
}

export interface FilterState {
  search: string;
  accountId: string;
  categoryId: string;
  type: string;
  fromDate: string;
  toDate: string;
  isInstallment: string; // 'all', 'installment', 'non-installment'
  assignedTo: string; // '' for all, or member id
}

export default function TransactionFilters({
  onFiltersChange,
  accounts,
  categories,
  members = [],
}: TransactionFiltersProps) {
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

  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      isInstallment: 'all',
      assignedTo: '',
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

  const hasActiveFilters = filters.search || filters.accountId || filters.categoryId || filters.type || filters.fromDate || filters.toDate || filters.isInstallment !== 'all' || filters.assignedTo;
  const hasAdvancedFilters = filters.isInstallment !== 'all' || filters.fromDate || filters.toDate || filters.assignedTo;

  return (
    <div className="glass-card p-3 md:p-4 space-y-3 md:space-y-4">
      {/* First Row: Search and Basic Filters */}
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-3">
        {/* Search - Full width on mobile */}
        <div className="md:col-span-2 lg:col-span-2">
          <div className="relative">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <input
              type="text"
              placeholder="Buscar transação..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 md:py-2.5 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        {/* Mobile: 2-column grid for selects */}
        <div className="grid grid-cols-2 gap-2 md:contents">
          <select
            value={filters.accountId}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
            className="px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
          >
            <option value="">Todas contas</option>
            {accounts.map((account) => {
              const isCreditCard = account.type === 'credit' || account.type === 'credit_card';
              return (
                <option key={account.id} value={account.id}>
                  {isCreditCard ? `Cartão de crédito: ${account.name}` : account.name}
                </option>
              );
            })}
          </select>

          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
          >
            <option value="">Todos tipos</option>
            <option value="income">Receita</option>
            <option value="expense">Despesa</option>
          </select>
        </div>

        {/* Category - Full width on mobile, hidden in mobile grid */}
        <select
          value={filters.categoryId}
          onChange={(e) => handleFilterChange('categoryId', e.target.value)}
          className="px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors md:col-span-1"
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
            <optgroup label="Cartões de Crédito">
              {creditCardCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {investmentCategories.length > 0 && (
            <optgroup label="Investimentos">
              {investmentCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {goalCategories.length > 0 && (
            <optgroup label="Objetivos">
              {goalCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
          {debtCategories.length > 0 && (
            <optgroup label="Dívidas">
              {debtCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Mobile: Toggle for advanced filters */}
      <div className="flex items-center justify-between md:hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <i className={`bx ${showAdvanced ? 'bx-chevron-up' : 'bx-chevron-down'}`}></i>
          Filtros avançados
          {hasAdvancedFilters && (
            <span className="w-2 h-2 rounded-full bg-primary"></span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <i className='bx bx-x'></i> Limpar
          </button>
        )}
      </div>

      {/* Second Row: Advanced Filters and Date Range */}
      <div className={`${showAdvanced ? 'block' : 'hidden'} md:block border-t border-border pt-3 md:pt-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          {/* Advanced filters */}
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
              <label className="text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">Parcelas:</label>
              <select
                value={filters.isInstallment}
                onChange={(e) => handleFilterChange('isInstallment', e.target.value)}
                className="px-3 md:px-4 py-2 md:py-2.5 text-sm rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
              >
                <option value="all">Todas</option>
                <option value="installment">Parceladas</option>
                <option value="non-installment">Não parceladas</option>
              </select>
            </div>
            {members.length > 1 && (
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                <label className="text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">Responsável:</label>
                <select
                  value={filters.assignedTo}
                  onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                  className="px-3 md:px-4 py-2 md:py-2.5 text-sm rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="">Todos</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName || member.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Date range and clear */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
              <label className="text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">Período:</label>
              <DateRangeFilter
                startDate={filters.fromDate}
                endDate={filters.toDate}
                onDateChange={handleDateRangeChange}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="hidden md:flex items-center px-4 py-2.5 rounded-xl bg-muted/50 border border-border hover:bg-muted transition-colors text-sm whitespace-nowrap"
              >
                <i className='bx bx-x mr-1'></i> Limpar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




