-- Migration: Credit Card Bill Items
-- Description: Store credit card purchases separately from transactions

-- 1. Create credit_card_bill_items table
CREATE TABLE IF NOT EXISTS public.credit_card_bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  bill_id UUID REFERENCES public.credit_card_bills(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  posted_at DATE NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'pluggy', 'import')),
  provider_tx_id TEXT,
  installment_parent_id UUID REFERENCES public.credit_card_bill_items(id) ON DELETE SET NULL,
  installment_number INTEGER,
  installment_total INTEGER,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_items_user ON public.credit_card_bill_items(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_items_account ON public.credit_card_bill_items(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_items_bill ON public.credit_card_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_items_posted_at ON public.credit_card_bill_items(posted_at);
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_items_parent ON public.credit_card_bill_items(installment_parent_id) WHERE installment_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_items_provider ON public.credit_card_bill_items(user_id, provider_tx_id) WHERE provider_tx_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE public.credit_card_bill_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view own credit card bill items" ON public.credit_card_bill_items;
DROP POLICY IF EXISTS "Users can insert own credit card bill items" ON public.credit_card_bill_items;
DROP POLICY IF EXISTS "Users can update own credit card bill items" ON public.credit_card_bill_items;
DROP POLICY IF EXISTS "Users can delete own credit card bill items" ON public.credit_card_bill_items;

CREATE POLICY "Users can view own credit card bill items" ON public.credit_card_bill_items
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credit card bill items" ON public.credit_card_bill_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own credit card bill items" ON public.credit_card_bill_items
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own credit card bill items" ON public.credit_card_bill_items
  FOR DELETE USING (user_id = auth.uid());

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS update_credit_card_bill_items_updated_at ON public.credit_card_bill_items;
CREATE TRIGGER update_credit_card_bill_items_updated_at BEFORE UPDATE ON public.credit_card_bill_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Migrate existing credit card transactions into bill items
INSERT INTO public.credit_card_bill_items (
  user_id,
  account_id,
  bill_id,
  category_id,
  posted_at,
  description,
  amount_cents,
  currency,
  notes,
  source,
  provider_tx_id,
  installment_number,
  installment_total,
  assigned_to
)
SELECT
  t.user_id,
  t.account_id,
  t.credit_card_bill_id,
  t.category_id,
  t.posted_at,
  t.description,
  ABS(ROUND((t.amount::NUMERIC) * 100))::BIGINT,
  t.currency,
  t.notes,
  t.source,
  t.provider_tx_id,
  t.installment_number,
  t.installment_total,
  t.assigned_to
FROM public.transactions t
WHERE t.credit_card_bill_id IS NOT NULL;

-- 7. Recalculate bill totals based on bill items
UPDATE public.credit_card_bills b
SET total_cents = totals.total_cents,
    minimum_payment_cents = GREATEST(ROUND(totals.total_cents * 0.15), 5000)
FROM (
  SELECT bill_id, COALESCE(SUM(amount_cents), 0) AS total_cents
  FROM public.credit_card_bill_items
  GROUP BY bill_id
) totals
WHERE b.id = totals.bill_id;

-- 8. Update available limits based on bill totals
UPDATE public.accounts a
SET available_balance = GREATEST(
  0,
  (a.credit_limit - (COALESCE(bill_totals.total_used, 0) / 100))
)
FROM (
  SELECT account_id, SUM(total_cents - paid_cents) AS total_used
  FROM public.credit_card_bills
  WHERE status <> 'paid'
  GROUP BY account_id
) bill_totals
WHERE a.id = bill_totals.account_id;

-- 9. Remove migrated credit card transactions (they are not real balance changes)
DELETE FROM public.transactions
WHERE credit_card_bill_id IS NOT NULL;

-- 10. Update bill recalculation function to use bill items
CREATE OR REPLACE FUNCTION recalculate_credit_card_bill(p_bill_id UUID) RETURNS VOID AS $$
DECLARE
  v_total BIGINT;
  v_account_id UUID;
  v_credit_limit NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_total
  FROM public.credit_card_bill_items
  WHERE bill_id = p_bill_id;

  UPDATE public.credit_card_bills
  SET total_cents = v_total,
      minimum_payment_cents = GREATEST(ROUND(v_total * 0.15), 5000)
  WHERE id = p_bill_id;

  SELECT account_id INTO v_account_id FROM public.credit_card_bills WHERE id = p_bill_id;
  SELECT credit_limit INTO v_credit_limit FROM public.accounts WHERE id = v_account_id;

  UPDATE public.accounts
  SET available_balance = v_credit_limit - (
    SELECT COALESCE(SUM((total_cents - paid_cents)::NUMERIC / 100), 0)
    FROM public.credit_card_bills
    WHERE account_id = v_account_id AND status NOT IN ('paid')
  )
  WHERE id = v_account_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Comments
COMMENT ON TABLE public.credit_card_bill_items IS 'Credit card purchases and installments attached to a bill';
COMMENT ON COLUMN public.credit_card_bill_items.amount_cents IS 'Amount for this bill item in cents (positive for charges)';
