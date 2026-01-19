-- Migration: Receivable custom plan entries
-- Description: Adds receivable_plan_entries table

CREATE TABLE IF NOT EXISTS public.receivable_plan_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receivable_id UUID REFERENCES public.receivables(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  entry_month DATE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receivable_plan_entries_receivable_month
  ON public.receivable_plan_entries(receivable_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_receivable_plan_entries_user_month
  ON public.receivable_plan_entries(user_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_receivable_plan_entries_user_category_month
  ON public.receivable_plan_entries(user_id, category_id, entry_month);

ALTER TABLE public.receivable_plan_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own receivable plan entries" ON public.receivable_plan_entries;
DROP POLICY IF EXISTS "Users can insert their own receivable plan entries" ON public.receivable_plan_entries;
DROP POLICY IF EXISTS "Users can update their own receivable plan entries" ON public.receivable_plan_entries;
DROP POLICY IF EXISTS "Users can delete their own receivable plan entries" ON public.receivable_plan_entries;

CREATE POLICY "Users can view their own receivable plan entries" ON public.receivable_plan_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own receivable plan entries" ON public.receivable_plan_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own receivable plan entries" ON public.receivable_plan_entries
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own receivable plan entries" ON public.receivable_plan_entries
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_receivable_plan_entries_updated_at ON public.receivable_plan_entries;
CREATE TRIGGER update_receivable_plan_entries_updated_at BEFORE UPDATE ON public.receivable_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.receivable_plan_entries IS 'Custom plan entries for receivable payments by month';
COMMENT ON COLUMN public.receivable_plan_entries.entry_month IS 'Month reference (YYYY-MM-01) for the planned receipt';
