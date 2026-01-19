-- Migration: Add receivable to budgets source_type
-- Description: Update budgets source_type constraint to include 'receivable'

-- Drop the old constraint
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_source_type_check;

-- Add the new constraint with receivable included
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_source_type_check
  CHECK (source_type IN ('manual', 'credit_card', 'goal', 'debt', 'receivable', 'recurring', 'installment', 'investment'));

-- Update comment
COMMENT ON COLUMN public.budgets.source_type IS 'Type of budget source: manual (user-created), credit_card (from bills), goal (from goal contributions), debt (from debt payments), receivable (from receivable payments), recurring (from recurring transactions), installment (from installment transactions), investment (from investment contributions)';
