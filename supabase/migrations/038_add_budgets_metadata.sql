-- Migration: Add budgets.metadata JSONB
-- Description: Store per-budget metadata (e.g., budget breakdown sub-items)

ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.budgets.metadata IS 'Arbitrary JSON metadata for budgets (e.g., budget_breakdown items)';

