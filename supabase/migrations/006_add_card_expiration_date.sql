-- Migration: Add expiration_date to credit cards
-- Description: Add expiration date field to accounts table for credit cards

-- Add expiration_date column to accounts table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Add comment
COMMENT ON COLUMN public.accounts.expiration_date IS 'Credit card expiration date (MM/YY format stored as last day of month)';


