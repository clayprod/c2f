-- Migration: Unify Budgets and Projections
-- Description: Add fields for debt negotiations, goal projections, and expand budgets table to support unified projections system

-- 1. Add is_negotiated field to debts table
ALTER TABLE public.debts
ADD COLUMN IF NOT EXISTS is_negotiated BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN public.debts.is_negotiated IS 'Flag indicating if debt is part of a negotiated payment plan with installments';

-- 2. Add include_in_projection field to goals table
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS include_in_projection BOOLEAN DEFAULT TRUE;

-- Add comment
COMMENT ON COLUMN public.goals.include_in_projection IS 'Flag indicating if goal monthly contributions should be included in financial projections';

-- 3. Expand budgets table to support different source types
-- First add columns without constraint
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS is_projected BOOLEAN DEFAULT FALSE;

-- Set default for existing rows
UPDATE public.budgets SET source_type = 'manual' WHERE source_type IS NULL;
UPDATE public.budgets SET is_projected = FALSE WHERE is_projected IS NULL;

-- Now add the constraint and set NOT NULL
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'budgets_source_type_check'
  ) THEN
    ALTER TABLE public.budgets DROP CONSTRAINT budgets_source_type_check;
  END IF;
  
  -- Set NOT NULL and DEFAULT first
  ALTER TABLE public.budgets
  ALTER COLUMN source_type SET DEFAULT 'manual';
  
  -- Ensure all rows have a value
  UPDATE public.budgets SET source_type = 'manual' WHERE source_type IS NULL;
  
  -- Now set NOT NULL
  ALTER TABLE public.budgets
  ALTER COLUMN source_type SET NOT NULL;
  
  -- Add the constraint
  ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_source_type_check
  CHECK (source_type IN ('manual', 'credit_card', 'goal', 'debt', 'recurring', 'installment'));
END $$;

-- Add comments
COMMENT ON COLUMN public.budgets.source_type IS 'Type of budget source: manual (user-created), credit_card (from bills), goal (from goal contributions), debt (from debt payments), recurring (from recurring transactions), installment (from installment transactions)';
COMMENT ON COLUMN public.budgets.source_id IS 'Reference to the source entity (e.g., credit_card_bill_id, goal_id, debt_id, transaction_id)';
COMMENT ON COLUMN public.budgets.is_projected IS 'Flag indicating if this is a projected budget (future) vs actual budget (past/current)';

-- 4. Create indexes for performance
-- Index for source lookups
CREATE INDEX IF NOT EXISTS idx_budgets_source ON public.budgets(user_id, source_type, source_id)
WHERE source_id IS NOT NULL;

-- Index for projected budgets queries
CREATE INDEX IF NOT EXISTS idx_budgets_projected ON public.budgets(user_id, is_projected, year, month);

-- Composite index for frequent queries
CREATE INDEX IF NOT EXISTS idx_budgets_user_year_month_type ON public.budgets(user_id, year, month, source_type);

-- Indexes for debts used in projections
CREATE INDEX IF NOT EXISTS idx_debts_negotiated ON public.debts(user_id, is_negotiated, status) 
WHERE is_negotiated = TRUE;

-- Indexes for goals used in projections
CREATE INDEX IF NOT EXISTS idx_goals_projection ON public.goals(user_id, status, include_in_projection) 
WHERE status = 'active' AND include_in_projection = TRUE;

