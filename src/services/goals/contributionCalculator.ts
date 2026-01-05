/**
 * Calculate monthly contribution for goals based on target date and amount
 */

export interface GoalContributionInput {
  target_amount_cents: number;
  current_amount_cents: number;
  target_date: string | Date | null;
  start_date: string | Date | null;
  monthly_contribution_cents?: number | null;
}

/**
 * Calculate monthly contribution amount needed to reach goal by target date
 * Formula: (target_amount_cents - current_amount_cents) / months_remaining
 */
export function calculateMonthlyContribution(input: GoalContributionInput): number | null {
  const {
    target_amount_cents,
    current_amount_cents,
    target_date,
    start_date,
    monthly_contribution_cents,
  } = input;

  // If monthly_contribution_cents is already set, use it
  if (monthly_contribution_cents && monthly_contribution_cents > 0) {
    return monthly_contribution_cents;
  }

  // Need target_date to calculate
  if (!target_date) {
    return null;
  }

  const targetDate = typeof target_date === 'string' ? new Date(target_date + 'T12:00:00') : target_date;
  const startDate = start_date 
    ? (typeof start_date === 'string' ? new Date(start_date + 'T12:00:00') : start_date)
    : new Date();

  // Calculate months remaining
  const now = new Date();
  const referenceDate = startDate > now ? startDate : now;
  
  const monthsRemaining = calculateMonthsBetween(referenceDate, targetDate);

  // If no months remaining or already reached goal, return null
  if (monthsRemaining <= 0) {
    return null;
  }

  const remainingAmount = target_amount_cents - current_amount_cents;

  // If already reached or exceeded goal, return 0
  if (remainingAmount <= 0) {
    return 0;
  }

  // Calculate monthly contribution needed
  const monthlyCents = Math.ceil(remainingAmount / monthsRemaining);

  return monthlyCents;
}

/**
 * Calculate number of months between two dates
 */
function calculateMonthsBetween(startDate: Date, endDate: Date): number {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  const monthsDiff = (endYear - startYear) * 12 + (endMonth - startMonth);

  // If end date is in the same month but later in the month, count it
  if (endDate.getDate() >= startDate.getDate()) {
    return Math.max(1, monthsDiff);
  }

  // If end date is earlier in the month, subtract one
  return Math.max(1, monthsDiff - 1);
}

/**
 * Validate if goal can have automatic budget generation
 */
export function canGenerateAutoBudgets(input: {
  include_in_budget: boolean;
  status: string;
  contribution_frequency?: string | null;
  monthly_contribution_cents?: number | null;
  target_date?: string | Date | null;
  target_amount_cents?: number;
  current_amount_cents?: number;
}): boolean {
  // Must be active and included in budget
  if (!input.include_in_budget || input.status !== 'active') {
    return false;
  }

  // Must have contribution frequency
  if (!input.contribution_frequency) {
    return false;
  }

  // Must have monthly contribution (calculated or set)
  const monthlyCents = input.monthly_contribution_cents || 
    (input.target_date && input.target_amount_cents && input.current_amount_cents
      ? calculateMonthlyContribution({
          target_amount_cents: input.target_amount_cents,
          current_amount_cents: input.current_amount_cents || 0,
          target_date: input.target_date,
          start_date: null,
        })
      : null);

  return monthlyCents !== null && monthlyCents > 0;
}

