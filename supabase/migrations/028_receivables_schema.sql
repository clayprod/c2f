-- Migration: Receivables Schema
-- Description: Tables for receivables tracking (money owed to the user by others)

-- 1. Receivables table
CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  debtor_name TEXT,
  total_amount_cents BIGINT NOT NULL,
  received_amount_cents BIGINT DEFAULT 0,
  remaining_amount_cents BIGINT GENERATED ALWAYS AS (total_amount_cents - received_amount_cents) STORED,
  interest_rate NUMERIC DEFAULT 0,
  due_date DATE,
  start_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'negociada')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  notes TEXT,
  payment_frequency TEXT CHECK (payment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  payment_amount_cents BIGINT,
  installment_count INTEGER,
  include_in_plan BOOLEAN DEFAULT FALSE,
  contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  monthly_payment_cents BIGINT DEFAULT 0,
  installment_amount_cents BIGINT,
  installment_day INTEGER CHECK (installment_day >= 1 AND installment_day <= 31),
  is_negotiated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Receivable Payments table
CREATE TABLE IF NOT EXISTS public.receivable_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receivable_id UUID REFERENCES public.receivables(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_cents BIGINT NOT NULL,
  payment_date DATE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receivables_user_id ON public.receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(user_id, status);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_receivable_id ON public.receivable_payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_user_id ON public.receivable_payments(user_id);

-- Enable RLS
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receivables
DROP POLICY IF EXISTS "Users can view their own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can insert their own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can update their own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can delete their own receivables" ON public.receivables;

CREATE POLICY "Users can view their own receivables" ON public.receivables
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own receivables" ON public.receivables
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own receivables" ON public.receivables
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own receivables" ON public.receivables
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for receivable_payments
DROP POLICY IF EXISTS "Users can view their own receivable payments" ON public.receivable_payments;
DROP POLICY IF EXISTS "Users can insert their own receivable payments" ON public.receivable_payments;
DROP POLICY IF EXISTS "Users can update their own receivable payments" ON public.receivable_payments;
DROP POLICY IF EXISTS "Users can delete their own receivable payments" ON public.receivable_payments;

CREATE POLICY "Users can view their own receivable payments" ON public.receivable_payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own receivable payments" ON public.receivable_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own receivable payments" ON public.receivable_payments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own receivable payments" ON public.receivable_payments
  FOR DELETE USING (user_id = auth.uid());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_receivables_updated_at ON public.receivables;
CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.receivables IS 'Money owed to the user by others (inverse of debts)';
COMMENT ON COLUMN public.receivables.debtor_name IS 'Name of the person/entity that owes money to the user';
COMMENT ON COLUMN public.receivables.received_amount_cents IS 'Amount already received in cents';
COMMENT ON COLUMN public.receivables.remaining_amount_cents IS 'Remaining amount to be received (calculated)';
COMMENT ON COLUMN public.receivables.payment_frequency IS 'Frequency of negotiated receivable payments (daily, weekly, biweekly, monthly, quarterly, yearly)';
COMMENT ON COLUMN public.receivables.payment_amount_cents IS 'Amount per payment installment in cents';
COMMENT ON COLUMN public.receivables.installment_count IS 'Total number of installments for negotiated receivable';
COMMENT ON COLUMN public.receivables.is_negotiated IS 'Flag indicating if receivable is part of a negotiated payment plan with installments';
COMMENT ON COLUMN public.receivables.include_in_plan IS 'Flag indicating if receivable payments should be included in budgets (only for negotiated receivables)';
