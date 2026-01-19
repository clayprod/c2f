-- Migration: Goals, Debts, and Investments Schema
-- Description: Tables for financial goals, debts tracking, and investments management

-- 1. Goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_amount_cents BIGINT NOT NULL,
  current_amount_cents BIGINT DEFAULT 0,
  progress_percentage NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN target_amount_cents > 0 THEN ((current_amount_cents::NUMERIC / target_amount_cents::NUMERIC) * 100)
      ELSE 0
    END
  ) STORED,
  target_date DATE,
  start_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#6b7280',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Goal Contributions table
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_cents BIGINT NOT NULL,
  contribution_date DATE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Debts table
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  creditor_name TEXT,
  total_amount_cents BIGINT NOT NULL,
  paid_amount_cents BIGINT DEFAULT 0,
  remaining_amount_cents BIGINT GENERATED ALWAYS AS (total_amount_cents - paid_amount_cents) STORED,
  interest_rate NUMERIC DEFAULT 0,
  due_date DATE,
  start_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue', 'negotiating')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Debt Payments table
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_cents BIGINT NOT NULL,
  payment_date DATE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Investments table
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stocks', 'bonds', 'funds', 'crypto', 'real_estate', 'other')),
  institution TEXT,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  initial_investment_cents BIGINT NOT NULL,
  current_value_cents BIGINT,
  purchase_date DATE NOT NULL,
  sale_date DATE,
  quantity NUMERIC,
  unit_price_cents BIGINT,
  currency TEXT DEFAULT 'BRL',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'matured')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Investment Transactions table
CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'interest', 'fee', 'adjustment')),
  amount_cents BIGINT NOT NULL,
  quantity NUMERIC,
  unit_price_cents BIGINT,
  transaction_date DATE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id ON public.goal_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user_id ON public.debt_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON public.investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_investment_id ON public.investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_id ON public.investment_transactions(user_id);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goals
DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;

CREATE POLICY "Users can view their own goals" ON public.goals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own goals" ON public.goals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own goals" ON public.goals
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own goals" ON public.goals
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for goal_contributions
DROP POLICY IF EXISTS "Users can view their own goal contributions" ON public.goal_contributions;
DROP POLICY IF EXISTS "Users can insert their own goal contributions" ON public.goal_contributions;
DROP POLICY IF EXISTS "Users can update their own goal contributions" ON public.goal_contributions;
DROP POLICY IF EXISTS "Users can delete their own goal contributions" ON public.goal_contributions;

CREATE POLICY "Users can view their own goal contributions" ON public.goal_contributions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own goal contributions" ON public.goal_contributions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own goal contributions" ON public.goal_contributions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own goal contributions" ON public.goal_contributions
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for debts
DROP POLICY IF EXISTS "Users can view their own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert their own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update their own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete their own debts" ON public.debts;

CREATE POLICY "Users can view their own debts" ON public.debts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own debts" ON public.debts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own debts" ON public.debts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own debts" ON public.debts
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for debt_payments
DROP POLICY IF EXISTS "Users can view their own debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can insert their own debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can update their own debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Users can delete their own debt payments" ON public.debt_payments;

CREATE POLICY "Users can view their own debt payments" ON public.debt_payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own debt payments" ON public.debt_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own debt payments" ON public.debt_payments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own debt payments" ON public.debt_payments
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for investments
DROP POLICY IF EXISTS "Users can view their own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert their own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update their own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete their own investments" ON public.investments;

CREATE POLICY "Users can view their own investments" ON public.investments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own investments" ON public.investments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own investments" ON public.investments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own investments" ON public.investments
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for investment_transactions
DROP POLICY IF EXISTS "Users can view their own investment transactions" ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can insert their own investment transactions" ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can update their own investment transactions" ON public.investment_transactions;
DROP POLICY IF EXISTS "Users can delete their own investment transactions" ON public.investment_transactions;

CREATE POLICY "Users can view their own investment transactions" ON public.investment_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own investment transactions" ON public.investment_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own investment transactions" ON public.investment_transactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own investment transactions" ON public.investment_transactions
  FOR DELETE USING (user_id = auth.uid());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
DROP TRIGGER IF EXISTS update_debts_updated_at ON public.debts;
DROP TRIGGER IF EXISTS update_investments_updated_at ON public.investments;

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



