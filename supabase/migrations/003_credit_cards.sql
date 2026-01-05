-- Migration: Credit Cards Schema
-- Description: Add credit card specific fields to accounts and create credit_card_bills table

-- 1. Update accounts type constraint to include 'credit_card'
-- First, drop any existing type constraint (handles both named and unnamed constraints)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find and drop any check constraint on the type column
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'accounts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%type%'
  LOOP
    EXECUTE 'ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS ' || constraint_name;
  END LOOP;
END $$;

-- Add the new type constraint with credit_card included
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('checking', 'savings', 'credit', 'credit_card', 'investment'));

-- 2. Add credit card specific columns to accounts table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS last_four_digits TEXT,
ADD COLUMN IF NOT EXISTS card_brand TEXT,
ADD COLUMN IF NOT EXISTS credit_limit_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_limit_cents BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_day SMALLINT,
ADD COLUMN IF NOT EXISTS due_day SMALLINT,
ADD COLUMN IF NOT EXISTS interest_rate_monthly NUMERIC(6,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_rate_annual NUMERIC(6,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280',
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '💳',
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Add named constraints for validation (these can be dropped and recreated if needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_card_brand_check') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_card_brand_check
      CHECK (card_brand IS NULL OR card_brand IN ('visa', 'mastercard', 'amex', 'elo', 'hipercard', 'diners', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_closing_day_check') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_closing_day_check
      CHECK (closing_day IS NULL OR (closing_day >= 1 AND closing_day <= 31));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_due_day_check') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_due_day_check
      CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));
  END IF;
END $$;

-- 3. Create credit_card_bills table for invoice management
CREATE TABLE IF NOT EXISTS public.credit_card_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,

  -- Reference period
  reference_month DATE NOT NULL, -- First day of the month (YYYY-MM-01)

  -- Dates
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Amounts
  total_cents BIGINT DEFAULT 0,
  minimum_payment_cents BIGINT DEFAULT 0,
  paid_cents BIGINT DEFAULT 0,

  -- Previous balance and interest
  previous_balance_cents BIGINT DEFAULT 0, -- Unpaid amount from previous bill
  interest_cents BIGINT DEFAULT 0, -- Interest charged on unpaid balance
  interest_rate_applied NUMERIC(6,3) DEFAULT 0, -- Rate used for this bill

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'partial', 'overdue')),

  -- Payment tracking
  payment_date DATE,
  payment_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Only one bill per card per month
  UNIQUE(account_id, reference_month)
);

-- 4. Add credit_card_bill_id to transactions for linking
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS credit_card_bill_id UUID REFERENCES public.credit_card_bills(id) ON DELETE SET NULL;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_credit_card ON public.accounts(user_id, type) WHERE type = 'credit_card';
CREATE INDEX IF NOT EXISTS idx_credit_card_bills_account ON public.credit_card_bills(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_bills_user_id ON public.credit_card_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_bills_reference ON public.credit_card_bills(account_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_credit_card_bills_status ON public.credit_card_bills(status);
CREATE INDEX IF NOT EXISTS idx_credit_card_bills_due_date ON public.credit_card_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_credit_card_bill ON public.transactions(credit_card_bill_id) WHERE credit_card_bill_id IS NOT NULL;

-- 6. Enable RLS on credit_card_bills
ALTER TABLE public.credit_card_bills ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for credit_card_bills
DROP POLICY IF EXISTS "Users can view own credit card bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can insert own credit card bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can update own credit card bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can delete own credit card bills" ON public.credit_card_bills;

CREATE POLICY "Users can view own credit card bills" ON public.credit_card_bills
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credit card bills" ON public.credit_card_bills
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own credit card bills" ON public.credit_card_bills
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own credit card bills" ON public.credit_card_bills
  FOR DELETE USING (user_id = auth.uid());

-- 8. Trigger for updated_at on credit_card_bills
DROP TRIGGER IF EXISTS update_credit_card_bills_updated_at ON public.credit_card_bills;
CREATE TRIGGER update_credit_card_bills_updated_at BEFORE UPDATE ON public.credit_card_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Comments for documentation
COMMENT ON TABLE public.credit_card_bills IS 'Credit card monthly invoices/bills';
COMMENT ON COLUMN public.accounts.last_four_digits IS 'Last 4 digits of credit card number';
COMMENT ON COLUMN public.accounts.card_brand IS 'Credit card brand (visa, mastercard, etc)';
COMMENT ON COLUMN public.accounts.credit_limit_cents IS 'Total credit limit in cents';
COMMENT ON COLUMN public.accounts.available_limit_cents IS 'Available credit limit in cents (credit_limit - used)';
COMMENT ON COLUMN public.accounts.closing_day IS 'Day of month when bill closes (1-31)';
COMMENT ON COLUMN public.accounts.due_day IS 'Day of month when bill is due (1-31)';
COMMENT ON COLUMN public.accounts.interest_rate_monthly IS 'Monthly interest rate for revolving credit';
COMMENT ON COLUMN public.accounts.interest_rate_annual IS 'Annual interest rate for revolving credit';
COMMENT ON COLUMN public.credit_card_bills.reference_month IS 'The month this bill refers to (stored as first day of month)';
COMMENT ON COLUMN public.credit_card_bills.closing_date IS 'Date when the bill closed for new transactions';
COMMENT ON COLUMN public.credit_card_bills.due_date IS 'Payment due date for the bill';
COMMENT ON COLUMN public.credit_card_bills.total_cents IS 'Total bill amount in cents';
COMMENT ON COLUMN public.credit_card_bills.minimum_payment_cents IS 'Minimum payment amount in cents';
COMMENT ON COLUMN public.credit_card_bills.paid_cents IS 'Amount already paid in cents';
COMMENT ON COLUMN public.credit_card_bills.status IS 'Bill status: open (current), closed (awaiting payment), paid, partial (partially paid), overdue';

-- 10. Function to calculate which bill a transaction belongs to based on date and card closing day
CREATE OR REPLACE FUNCTION get_credit_card_bill_month(
  p_transaction_date DATE,
  p_closing_day SMALLINT
) RETURNS DATE AS $$
DECLARE
  v_day_of_month INTEGER;
  v_reference_date DATE;
BEGIN
  v_day_of_month := EXTRACT(DAY FROM p_transaction_date);

  -- If transaction is after closing day, it goes to next month's bill
  IF v_day_of_month > p_closing_day THEN
    v_reference_date := DATE_TRUNC('month', p_transaction_date + INTERVAL '1 month');
  ELSE
    v_reference_date := DATE_TRUNC('month', p_transaction_date);
  END IF;

  RETURN v_reference_date::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 11. Function to auto-create or get bill for a credit card transaction
CREATE OR REPLACE FUNCTION get_or_create_credit_card_bill(
  p_user_id UUID,
  p_account_id UUID,
  p_transaction_date DATE
) RETURNS UUID AS $$
DECLARE
  v_closing_day SMALLINT;
  v_due_day SMALLINT;
  v_reference_month DATE;
  v_closing_date DATE;
  v_due_date DATE;
  v_bill_id UUID;
BEGIN
  -- Get card closing and due days
  SELECT closing_day, due_day INTO v_closing_day, v_due_day
  FROM public.accounts
  WHERE id = p_account_id AND type = 'credit_card';

  IF v_closing_day IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate reference month
  v_reference_month := get_credit_card_bill_month(p_transaction_date, v_closing_day);

  -- Calculate actual closing and due dates for this month
  v_closing_date := (v_reference_month + ((v_closing_day - 1) || ' days')::INTERVAL)::DATE;
  v_due_date := (v_reference_month + ((v_due_day - 1) || ' days')::INTERVAL)::DATE;

  -- Try to get existing bill
  SELECT id INTO v_bill_id
  FROM public.credit_card_bills
  WHERE account_id = p_account_id AND reference_month = v_reference_month;

  -- If no bill exists, create one
  IF v_bill_id IS NULL THEN
    INSERT INTO public.credit_card_bills (
      user_id, account_id, reference_month, closing_date, due_date, status
    ) VALUES (
      p_user_id, p_account_id, v_reference_month, v_closing_date, v_due_date, 'open'
    ) RETURNING id INTO v_bill_id;
  END IF;

  RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql;

-- 12. Function to recalculate bill totals
CREATE OR REPLACE FUNCTION recalculate_credit_card_bill(p_bill_id UUID) RETURNS VOID AS $$
DECLARE
  v_total NUMERIC;
  v_account_id UUID;
  v_credit_limit NUMERIC;
BEGIN
  -- Sum all transactions for this bill
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total
  FROM public.transactions
  WHERE credit_card_bill_id = p_bill_id AND amount < 0; -- Only expenses

  -- Update bill total (convert to cents for storage)
  UPDATE public.credit_card_bills
  SET total_cents = (v_total * 100)::BIGINT,
      minimum_payment_cents = GREATEST((v_total * 0.15 * 100)::BIGINT, 5000) -- 15% minimum or R$50
  WHERE id = p_bill_id;

  -- Update available limit on the card
  SELECT account_id INTO v_account_id FROM public.credit_card_bills WHERE id = p_bill_id;
  SELECT credit_limit INTO v_credit_limit FROM public.accounts WHERE id = v_account_id;

  -- Calculate total open bills for this card (convert cents back to numeric)
  UPDATE public.accounts
  SET available_limit = v_credit_limit - (
    SELECT COALESCE(SUM((total_cents - paid_cents)::NUMERIC / 100), 0)
    FROM public.credit_card_bills
    WHERE account_id = v_account_id AND status NOT IN ('paid')
  )
  WHERE id = v_account_id;
END;
$$ LANGUAGE plpgsql;
