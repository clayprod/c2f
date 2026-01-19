-- Migration: Remove is_recurring field from transactions
-- Description: Remove is_recurring column and related index as recurring transactions have been removed from the system

-- Drop index first
DROP INDEX IF EXISTS idx_transactions_is_recurring;

-- Remove column from transactions table (if it exists)
ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS is_recurring;
