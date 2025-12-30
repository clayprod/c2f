-- Migration: Initial Schema
-- Description: Core tables for c2Finance (profiles, accounts, categories, transactions, budgets, advisor_insights, billing, imports)

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, name, type)
);

-- 3. Accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'investment')),
  balance_cents BIGINT DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'BRL',
  institution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  posted_at DATE NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  month DATE NOT NULL,
  limit_cents BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, category_id, month)
);

-- 6. Advisor Insights table
CREATE TABLE IF NOT EXISTS public.advisor_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  insights JSONB DEFAULT '[]'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  citations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Billing Customers table
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Billing Subscriptions table
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Imports table
CREATE TABLE IF NOT EXISTS public.imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  dedupe_hash TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON public.accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_owner_id ON public.categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_owner_id ON public.transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON public.transactions(owner_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_owner_id ON public.budgets(owner_id);
CREATE INDEX IF NOT EXISTS idx_advisor_insights_owner_id ON public.advisor_insights(owner_id);
CREATE INDEX IF NOT EXISTS idx_imports_owner_id ON public.imports(owner_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for categories
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for budgets
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for advisor_insights
DROP POLICY IF EXISTS "Users can view own advisor insights" ON public.advisor_insights;
DROP POLICY IF EXISTS "Users can insert own advisor insights" ON public.advisor_insights;
DROP POLICY IF EXISTS "Users can delete own advisor insights" ON public.advisor_insights;

CREATE POLICY "Users can view own advisor insights" ON public.advisor_insights
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own advisor insights" ON public.advisor_insights
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own advisor insights" ON public.advisor_insights
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for billing_customers
DROP POLICY IF EXISTS "Users can view own billing customer" ON public.billing_customers;
DROP POLICY IF EXISTS "Users can insert own billing customer" ON public.billing_customers;
DROP POLICY IF EXISTS "Users can update own billing customer" ON public.billing_customers;

CREATE POLICY "Users can view own billing customer" ON public.billing_customers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own billing customer" ON public.billing_customers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own billing customer" ON public.billing_customers
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for billing_subscriptions
DROP POLICY IF EXISTS "Users can view own billing subscription" ON public.billing_subscriptions;
DROP POLICY IF EXISTS "Users can insert own billing subscription" ON public.billing_subscriptions;
DROP POLICY IF EXISTS "Users can update own billing subscription" ON public.billing_subscriptions;

CREATE POLICY "Users can view own billing subscription" ON public.billing_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own billing subscription" ON public.billing_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own billing subscription" ON public.billing_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for imports
DROP POLICY IF EXISTS "Users can view own imports" ON public.imports;
DROP POLICY IF EXISTS "Users can insert own imports" ON public.imports;
DROP POLICY IF EXISTS "Users can update own imports" ON public.imports;
DROP POLICY IF EXISTS "Users can delete own imports" ON public.imports;

CREATE POLICY "Users can view own imports" ON public.imports
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own imports" ON public.imports
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own imports" ON public.imports
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own imports" ON public.imports
  FOR DELETE USING (owner_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
DROP TRIGGER IF EXISTS update_billing_customers_updated_at ON public.billing_customers;
DROP TRIGGER IF EXISTS update_billing_subscriptions_updated_at ON public.billing_subscriptions;
DROP TRIGGER IF EXISTS update_imports_updated_at ON public.imports;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_customers_updated_at BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_subscriptions_updated_at BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON public.imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


