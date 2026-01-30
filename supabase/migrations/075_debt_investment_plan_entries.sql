-- Migration: Debt and investment custom plan entries
-- Description: Adds debt_plan_entries and investment_plan_entries tables

-- 1) debt_plan_entries table
CREATE TABLE IF NOT EXISTS public.debt_plan_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  entry_month DATE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_plan_entries_debt_month
  ON public.debt_plan_entries(debt_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_debt_plan_entries_user_month
  ON public.debt_plan_entries(user_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_debt_plan_entries_user_category_month
  ON public.debt_plan_entries(user_id, category_id, entry_month);

ALTER TABLE public.debt_plan_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own debt plan entries" ON public.debt_plan_entries;
DROP POLICY IF EXISTS "Users can insert their own debt plan entries" ON public.debt_plan_entries;
DROP POLICY IF EXISTS "Users can update their own debt plan entries" ON public.debt_plan_entries;
DROP POLICY IF EXISTS "Users can delete their own debt plan entries" ON public.debt_plan_entries;

CREATE POLICY "Users can view their own debt plan entries" ON public.debt_plan_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own debt plan entries" ON public.debt_plan_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own debt plan entries" ON public.debt_plan_entries
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own debt plan entries" ON public.debt_plan_entries
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_debt_plan_entries_updated_at ON public.debt_plan_entries;
CREATE TRIGGER update_debt_plan_entries_updated_at BEFORE UPDATE ON public.debt_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.debt_plan_entries IS 'Custom plan entries for debt payments by month';
COMMENT ON COLUMN public.debt_plan_entries.entry_month IS 'Month reference (YYYY-MM-01) for the planned payment';

-- 2) investment_plan_entries table
CREATE TABLE IF NOT EXISTS public.investment_plan_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  entry_month DATE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_investment_plan_entries_investment_month
  ON public.investment_plan_entries(investment_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_investment_plan_entries_user_month
  ON public.investment_plan_entries(user_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_investment_plan_entries_user_category_month
  ON public.investment_plan_entries(user_id, category_id, entry_month);

ALTER TABLE public.investment_plan_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own investment plan entries" ON public.investment_plan_entries;
DROP POLICY IF EXISTS "Users can insert their own investment plan entries" ON public.investment_plan_entries;
DROP POLICY IF EXISTS "Users can update their own investment plan entries" ON public.investment_plan_entries;
DROP POLICY IF EXISTS "Users can delete their own investment plan entries" ON public.investment_plan_entries;

CREATE POLICY "Users can view their own investment plan entries" ON public.investment_plan_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own investment plan entries" ON public.investment_plan_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own investment plan entries" ON public.investment_plan_entries
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own investment plan entries" ON public.investment_plan_entries
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_investment_plan_entries_updated_at ON public.investment_plan_entries;
CREATE TRIGGER update_investment_plan_entries_updated_at BEFORE UPDATE ON public.investment_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.investment_plan_entries IS 'Custom plan entries for investment contributions by month';
COMMENT ON COLUMN public.investment_plan_entries.entry_month IS 'Month reference (YYYY-MM-01) for the planned contribution';
