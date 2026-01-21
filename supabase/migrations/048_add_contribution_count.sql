-- Migration: Add contribution_count field
-- Description: Add field to limit the number of contributions/payments in budget generation

-- Add contribution_count column to goals
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS contribution_count INTEGER;

COMMENT ON COLUMN public.goals.contribution_count IS 'Total number of contributions to generate in budgets. NULL means continuous/unlimited.';

-- Add contribution_count column to debts
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS contribution_count INTEGER;

COMMENT ON COLUMN public.debts.contribution_count IS 'Total number of payments to generate in budgets. NULL means continuous/unlimited.';

-- Add contribution_count column to investments
ALTER TABLE public.investments 
ADD COLUMN IF NOT EXISTS contribution_count INTEGER;

COMMENT ON COLUMN public.investments.contribution_count IS 'Total number of contributions to generate in budgets. NULL means continuous/unlimited.';

-- Add contribution_count column to receivables
ALTER TABLE public.receivables 
ADD COLUMN IF NOT EXISTS contribution_count INTEGER;

COMMENT ON COLUMN public.receivables.contribution_count IS 'Total number of receivables to generate in budgets. NULL means continuous/unlimited.';
