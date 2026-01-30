-- Add initial_balance to accounts and backfill existing data
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS initial_balance NUMERIC DEFAULT 0;

UPDATE public.accounts
SET initial_balance = current_balance
WHERE initial_balance IS NULL;
