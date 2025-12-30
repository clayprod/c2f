-- Migration: Extended Transactions Schema
-- Description: Add fields for recurrence, installments, and deduplication

-- 1. Add new columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'pluggy', 'import')),
ADD COLUMN IF NOT EXISTS provider_tx_id TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
ADD COLUMN IF NOT EXISTS installment_parent_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS installment_number INTEGER,
ADD COLUMN IF NOT EXISTS installment_total INTEGER;

-- 2. Create index for deduplication (provider_tx_id lookup)
CREATE INDEX IF NOT EXISTS idx_transactions_provider_tx_id
ON public.transactions(user_id, provider_tx_id)
WHERE provider_tx_id IS NOT NULL;

-- 3. Create index for recurring transactions
CREATE INDEX IF NOT EXISTS idx_transactions_is_recurring
ON public.transactions(user_id, is_recurring)
WHERE is_recurring = TRUE;

-- 4. Create index for installment transactions
CREATE INDEX IF NOT EXISTS idx_transactions_installment_parent
ON public.transactions(installment_parent_id)
WHERE installment_parent_id IS NOT NULL;

-- 5. Add comment for documentation
COMMENT ON COLUMN public.transactions.source IS 'Source of transaction: manual (user input), pluggy (Open Finance), import (CSV/OFX)';
COMMENT ON COLUMN public.transactions.provider_tx_id IS 'External transaction ID for deduplication';
COMMENT ON COLUMN public.transactions.is_recurring IS 'Whether this is a recurring transaction';
COMMENT ON COLUMN public.transactions.recurrence_rule IS 'iCalendar RRULE format (e.g., FREQ=MONTHLY;INTERVAL=1)';
COMMENT ON COLUMN public.transactions.installment_parent_id IS 'Reference to parent transaction for installments';
COMMENT ON COLUMN public.transactions.installment_number IS 'Current installment number (1-based)';
COMMENT ON COLUMN public.transactions.installment_total IS 'Total number of installments';
