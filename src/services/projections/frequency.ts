/**
 * Frequency calculation utilities for budget projections
 */

export type ContributionFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Calculate how many times a contribution occurs per month based on frequency
 */
export function getOccurrencesPerMonth(frequency: ContributionFrequency): number {
  switch (frequency) {
    case 'daily':
      return 30; // Average days per month
    case 'weekly':
      return 4.33; // Average weeks per month (52/12)
    case 'biweekly':
      return 2.17; // Average biweeks per month
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3; // 4 times per year = 1/3 per month
    case 'yearly':
      return 1 / 12; // Once per year = 1/12 per month
    default:
      return 0;
  }
}

/**
 * Calculate monthly total from a single contribution amount and frequency
 */
export function calculateMonthlyTotal(
  amountCents: number,
  frequency: ContributionFrequency
): number {
  const occurrences = getOccurrencesPerMonth(frequency);
  return Math.round(amountCents * occurrences);
}

/**
 * Check if a contribution should be included in a specific month
 * based on frequency and start date
 */
export function shouldIncludeInMonth(
  frequency: ContributionFrequency,
  startDate: Date,
  targetMonth: Date
): boolean {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const targetYear = targetMonth.getFullYear();
  const targetMonthNum = targetMonth.getMonth();

  // If target is before start, don't include
  if (targetYear < startYear || (targetYear === startYear && targetMonthNum < startMonth)) {
    return false;
  }

  const monthsDiff = (targetYear - startYear) * 12 + (targetMonthNum - startMonth);

  switch (frequency) {
    case 'daily':
    case 'weekly':
    case 'biweekly':
    case 'monthly':
      // These occur every month after start
      return monthsDiff >= 0;
    
    case 'quarterly':
      // Every 3 months (0, 3, 6, 9 months from start)
      return monthsDiff >= 0 && monthsDiff % 3 === 0;
    
    case 'yearly':
      // Every 12 months (0, 12, 24, etc.)
      return monthsDiff >= 0 && monthsDiff % 12 === 0;
    
    default:
      return false;
  }
}

/**
 * Get the next occurrence date after a given date
 */
export function getNextOccurrenceDate(
  frequency: ContributionFrequency,
  lastDate: Date
): Date {
  const next = new Date(lastDate);
  
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  
  return next;
}

/**
 * Convert frequency to human-readable label
 */
export function getFrequencyLabel(frequency: ContributionFrequency): string {
  const labels: Record<ContributionFrequency, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual',
  };
  return labels[frequency] || frequency;
}



