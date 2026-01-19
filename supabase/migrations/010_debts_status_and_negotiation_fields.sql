-- Migration: Debts Status and Negotiation Fields
-- Description: Add negotiation fields and update status values for debts

-- Step 1: Add new columns for negotiation fields
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS payment_frequency TEXT CHECK (payment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS payment_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS installment_count INTEGER;

-- Step 2: Migrate existing status values to new format
-- Map 'paid' to 'paga' and 'negotiating' to 'negociando' for consistency
UPDATE public.debts
  SET status = CASE
    WHEN status = 'paid' THEN 'paga'
    WHEN status = 'negotiating' THEN 'negociando'
    ELSE status
  END
  WHERE status IN ('paid', 'negotiating');

-- Step 3: Drop the old constraint and create a new one with updated values
ALTER TABLE public.debts
  DROP CONSTRAINT IF EXISTS debts_status_check;

ALTER TABLE public.debts
  ADD CONSTRAINT debts_status_check CHECK (status IN ('active', 'paid', 'overdue', 'paga', 'negociando', 'negociada'));

-- Step 4: Add comments to new columns
COMMENT ON COLUMN public.debts.payment_frequency IS 'Frequency of negotiated debt payments (daily, weekly, biweekly, monthly, quarterly, yearly)';
COMMENT ON COLUMN public.debts.payment_amount_cents IS 'Amount per payment installment in cents (generic, not just monthly)';
COMMENT ON COLUMN public.debts.installment_count IS 'Total number of installments for negotiated debt';



