/**
 * Aggregations Service
 * Functions to aggregate transaction data for admin analytics
 */

import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export interface AggregationFilters {
  fromDate?: string;
  toDate?: string;
  period?: 'month' | '3months' | 'semester' | 'year';
  search?: string;
  minAge?: number;
  maxAge?: number;
  gender?: string;
  categoryId?: string;
  groupBy?: 'city' | 'state' | 'category' | 'month';
}

export interface AggregatedData {
  group: string;
  total_expenses: number;
  total_income: number;
  transaction_count: number;
  user_count: number;
}

/**
 * Calculate age from birth_date
 */
function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Get date range from period
 */
function getDateRangeFromPeriod(period: string): { fromDate: string; toDate: string } {
  const today = new Date();
  const toDate = today.toISOString().split('T')[0];
  
  let fromDate: Date;
  
  switch (period) {
    case 'month':
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case '3months':
      fromDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      break;
    case 'semester':
      fromDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      break;
    case 'year':
      fromDate = new Date(today.getFullYear(), 0, 1);
      break;
    default:
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  
  return {
    fromDate: fromDate.toISOString().split('T')[0],
    toDate,
  };
}

/**
 * Get aggregated transaction data
 */
export async function getAggregatedTransactions(
  request: NextRequest,
  filters: AggregationFilters
): Promise<AggregatedData[]> {
  const { supabase } = createClientFromRequest(request);

  // Determine date range
  let fromDate: string;
  let toDate: string;

  if (filters.fromDate && filters.toDate) {
    fromDate = filters.fromDate;
    toDate = filters.toDate;
  } else if (filters.period) {
    const range = getDateRangeFromPeriod(filters.period);
    fromDate = range.fromDate;
    toDate = range.toDate;
  } else {
    // Default to current month
    const range = getDateRangeFromPeriod('month');
    fromDate = range.fromDate;
    toDate = range.toDate;
  }

  // Build base query - fetch transactions first
  let query = supabase
    .from('transactions')
    .select(`
      id,
      amount,
      posted_at,
      categories(id, name),
      user_id
    `)
    .gte('posted_at', fromDate)
    .lte('posted_at', toDate);

  // Apply filters
  if (filters.search) {
    query = query.ilike('description', `%${filters.search}%`);
  }

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  const { data: transactions, error } = await query;

  if (error) {
    throw error;
  }

  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Get unique user IDs
  const userIds = [...new Set(transactions.map((tx: any) => tx.user_id))];

  // Fetch profiles separately to avoid relationship ambiguity
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, birth_date, gender, city, state')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  // Create a map for quick profile lookup
  const profilesMap = new Map(
    (profilesData || []).map((p: any) => [p.id, p])
  );

  // Filter by age and gender in memory (more efficient than complex SQL)
  let filteredTransactions = transactions.filter((tx: any) => {
    const profile = profilesMap.get(tx.user_id);
    if (!profile) return false;

    // Age filter
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const age = calculateAge(profile.birth_date);
      if (age === null) return false;
      if (filters.minAge !== undefined && age < filters.minAge) return false;
      if (filters.maxAge !== undefined && age > filters.maxAge) return false;
    }

    // Gender filter
    if (filters.gender && profile.gender !== filters.gender) {
      return false;
    }

    return true;
  });

  // Group by specified field
  const groupBy = filters.groupBy || 'state';
  const grouped = new Map<string, {
    expenses: number;
    income: number;
    count: number;
    users: Set<string>;
  }>();

  for (const tx of filteredTransactions) {
    const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
    const profile = profilesMap.get(tx.user_id);

    let groupKey: string;

    switch (groupBy) {
      case 'city':
        groupKey = profile?.city || 'Não informado';
        break;
      case 'state':
        groupKey = profile?.state || 'Não informado';
        break;
      case 'category':
        const category = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
        groupKey = category?.name || 'Sem categoria';
        break;
      case 'month':
        const date = new Date(tx.posted_at);
        groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        groupKey = profile?.state || 'Não informado';
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        expenses: 0,
        income: 0,
        count: 0,
        users: new Set(),
      });
    }

    const group = grouped.get(groupKey)!;
    group.users.add(tx.user_id);

    if (amount < 0) {
      group.expenses += Math.abs(amount);
    } else {
      group.income += amount;
    }
    group.count++;
  }

  // Convert to array format
  const result: AggregatedData[] = Array.from(grouped.entries()).map(([group, data]) => ({
    group,
    total_expenses: data.expenses,
    total_income: data.income,
    transaction_count: data.count,
    user_count: data.users.size,
  }));

  // Sort by total expenses descending
  result.sort((a, b) => b.total_expenses - a.total_expenses);

  return result;
}


