-- Migration: Budget Automatic Contributions
-- Description: Add fields for contribution frequency, include_in_budget flags, and minimum amount validation

-- 1. Goals: Add contribution frequency and budget inclusion
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS include_in_budget BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS monthly_contribution_cents BIGINT DEFAULT 0;

-- Set include_in_budget based on existing include_in_projection for backward compatibility
UPDATE public.goals 
SET include_in_budget = include_in_projection 
WHERE include_in_budget IS NULL;

-- Add comments
COMMENT ON COLUMN public.goals.include_in_budget IS 'Flag indicating if goal contributions should be included in budgets (separate from projections)';
COMMENT ON COLUMN public.goals.contribution_frequency IS 'Frequency of contributions: daily, weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.goals.monthly_contribution_cents IS 'Monthly contribution amount in cents (calculated or fixed)';

-- 2. Debts: Add contribution frequency and budget inclusion
ALTER TABLE public.debts
ADD COLUMN IF NOT EXISTS include_in_budget BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS monthly_payment_cents BIGINT DEFAULT 0;

-- Add comments
COMMENT ON COLUMN public.debts.include_in_budget IS 'Flag indicating if debt payments should be included in budgets (only for negotiated debts)';
COMMENT ON COLUMN public.debts.contribution_frequency IS 'Frequency of payments: daily, weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.debts.monthly_payment_cents IS 'Monthly payment amount in cents';

-- 3. Investments: Add contribution frequency and budget inclusion
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS include_in_budget BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS monthly_contribution_cents BIGINT DEFAULT 0;

-- Add comments
COMMENT ON COLUMN public.investments.include_in_budget IS 'Flag indicating if investment contributions should be included in budgets';
COMMENT ON COLUMN public.investments.contribution_frequency IS 'Frequency of contributions: daily, weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.investments.monthly_contribution_cents IS 'Monthly contribution amount in cents';

-- 4. Transactions: Add contribution frequency for recurring transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));

-- Add comment
COMMENT ON COLUMN public.transactions.contribution_frequency IS 'Frequency for recurring transactions used in budget calculations (separate from recurrence_rule)';

-- 5. Budgets: Add minimum amount and auto contributions tracking
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS minimum_amount_planned NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_contributions_cents BIGINT DEFAULT 0;

-- Add comments
COMMENT ON COLUMN public.budgets.minimum_amount_planned IS 'Minimum allowed amount_planned based on automatic contributions (in reais)';
COMMENT ON COLUMN public.budgets.auto_contributions_cents IS 'Sum of all automatic contributions in cents';

-- 6. Add constraint to ensure amount_planned >= minimum_amount_planned
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'budgets_minimum_check'
  ) THEN
    ALTER TABLE public.budgets DROP CONSTRAINT budgets_minimum_check;
  END IF;
  
  -- Add the constraint
  ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_minimum_check
  CHECK (amount_planned >= minimum_amount_planned);
END $$;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_budget_inclusion ON public.goals(user_id, include_in_budget, contribution_frequency)
WHERE include_in_budget = TRUE;

CREATE INDEX IF NOT EXISTS idx_debts_budget_inclusion ON public.debts(user_id, include_in_budget, is_negotiated, contribution_frequency)
WHERE include_in_budget = TRUE AND is_negotiated = TRUE;

CREATE INDEX IF NOT EXISTS idx_investments_budget_inclusion ON public.investments(user_id, include_in_budget, contribution_frequency)
WHERE include_in_budget = TRUE;

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_frequency ON public.transactions(user_id, category_id, contribution_frequency)
WHERE recurrence_rule IS NOT NULL OR contribution_frequency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_minimum ON public.budgets(user_id, category_id, minimum_amount_planned)
WHERE minimum_amount_planned > 0;


