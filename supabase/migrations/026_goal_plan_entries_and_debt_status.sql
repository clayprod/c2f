-- Migration: Goal custom plan entries and debt status simplification
-- Description: Adds goal_plan_entries table and simplifies debt status to pendente/negociada

-- 1) goal_plan_entries table
CREATE TABLE IF NOT EXISTS public.goal_plan_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  entry_month DATE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_plan_entries_goal_month
  ON public.goal_plan_entries(goal_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_goal_plan_entries_user_month
  ON public.goal_plan_entries(user_id, entry_month);
CREATE INDEX IF NOT EXISTS idx_goal_plan_entries_user_category_month
  ON public.goal_plan_entries(user_id, category_id, entry_month);

ALTER TABLE public.goal_plan_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own goal plan entries" ON public.goal_plan_entries;
DROP POLICY IF EXISTS "Users can insert their own goal plan entries" ON public.goal_plan_entries;
DROP POLICY IF EXISTS "Users can update their own goal plan entries" ON public.goal_plan_entries;
DROP POLICY IF EXISTS "Users can delete their own goal plan entries" ON public.goal_plan_entries;

CREATE POLICY "Users can view their own goal plan entries" ON public.goal_plan_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own goal plan entries" ON public.goal_plan_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own goal plan entries" ON public.goal_plan_entries
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own goal plan entries" ON public.goal_plan_entries
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_goal_plan_entries_updated_at ON public.goal_plan_entries;
CREATE TRIGGER update_goal_plan_entries_updated_at BEFORE UPDATE ON public.goal_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.goal_plan_entries IS 'Custom plan entries for goal contributions by month';
COMMENT ON COLUMN public.goal_plan_entries.entry_month IS 'Month reference (YYYY-MM-01) for the planned contribution';

-- 2) Simplify debt status values
ALTER TABLE public.debts
  DROP CONSTRAINT IF EXISTS debts_status_check;

UPDATE public.debts
  SET status = CASE
    WHEN status = 'negociada' THEN 'negociada'
    ELSE 'pendente'
  END;

ALTER TABLE public.debts
  ADD CONSTRAINT debts_status_check CHECK (status IN ('pendente', 'negociada'));

ALTER TABLE public.debts ALTER COLUMN status SET DEFAULT 'pendente';

-- Keep is_negotiated aligned with status
UPDATE public.debts
  SET is_negotiated = (status = 'negociada')
  WHERE is_negotiated IS DISTINCT FROM (status = 'negociada');
