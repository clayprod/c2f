-- Migration: Add is_auto_generated field to budgets
-- Description: Add flag to mark budgets that are automatically generated from goals, debts, investments, or credit cards

-- Add is_auto_generated column to budgets table
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT FALSE;

-- Set is_auto_generated = true for existing budgets that are not manual
UPDATE public.budgets
SET is_auto_generated = TRUE
WHERE source_type IN ('goal', 'debt', 'investment', 'credit_card')
  AND is_auto_generated = FALSE;

-- Add comment
COMMENT ON COLUMN public.budgets.is_auto_generated IS 'Flag indicating if budget was automatically generated from goals, debts, investments, or credit cards. These budgets cannot be manually edited.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_budgets_auto_generated ON public.budgets(user_id, is_auto_generated, source_type)
WHERE is_auto_generated = TRUE;


