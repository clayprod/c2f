-- Migration: Pluggy Schema
-- Description: Tables for Pluggy integration (items, accounts, transactions, sync logs)

-- 1. Pluggy Items table (espelha Items da Pluggy API)
CREATE TABLE IF NOT EXISTS public.pluggy_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT UNIQUE NOT NULL,
  connector_id TEXT,
  connector_name TEXT,
  status TEXT,
  error_code TEXT,
  error_message TEXT,
  execution_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Pluggy Accounts table (espelha Accounts da Pluggy API)
CREATE TABLE IF NOT EXISTS public.pluggy_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pluggy_account_id TEXT NOT NULL,
  item_id TEXT REFERENCES public.pluggy_items(item_id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  subtype TEXT,
  balance_cents BIGINT DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pluggy_account_id)
);

-- 3. Pluggy Transactions table (espelha Transactions da Pluggy API)
CREATE TABLE IF NOT EXISTS public.pluggy_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pluggy_transaction_id TEXT NOT NULL,
  account_id UUID REFERENCES public.pluggy_accounts(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT REFERENCES public.pluggy_items(item_id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  type TEXT CHECK (type IN ('credit', 'debit')),
  category TEXT,
  subcategory TEXT,
  hash TEXT NOT NULL, -- Para dedupe
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pluggy_transaction_id)
);

-- 4. Pluggy Sync Logs table
CREATE TABLE IF NOT EXISTS public.pluggy_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT REFERENCES public.pluggy_items(item_id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  accounts_synced INTEGER DEFAULT 0,
  transactions_synced INTEGER DEFAULT 0,
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pluggy_items_item_id ON public.pluggy_items(item_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_items_user_id ON public.pluggy_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_accounts_item_id ON public.pluggy_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_accounts_user_id ON public.pluggy_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_item_id ON public.pluggy_transactions(item_id, date);
CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_hash ON public.pluggy_transactions(hash);
CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_user_id ON public.pluggy_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_sync_logs_item_id ON public.pluggy_sync_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_sync_logs_user_id ON public.pluggy_sync_logs(user_id);

-- Enable RLS
ALTER TABLE public.pluggy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pluggy_items
DROP POLICY IF EXISTS "Users can view own pluggy items" ON public.pluggy_items;
DROP POLICY IF EXISTS "Users can insert own pluggy items" ON public.pluggy_items;
DROP POLICY IF EXISTS "Users can update own pluggy items" ON public.pluggy_items;
DROP POLICY IF EXISTS "Users can delete own pluggy items" ON public.pluggy_items;

CREATE POLICY "Users can view own pluggy items" ON public.pluggy_items
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pluggy items" ON public.pluggy_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pluggy items" ON public.pluggy_items
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own pluggy items" ON public.pluggy_items
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for pluggy_accounts
DROP POLICY IF EXISTS "Users can view own pluggy accounts" ON public.pluggy_accounts;
DROP POLICY IF EXISTS "Users can insert own pluggy accounts" ON public.pluggy_accounts;
DROP POLICY IF EXISTS "Users can update own pluggy accounts" ON public.pluggy_accounts;
DROP POLICY IF EXISTS "Users can delete own pluggy accounts" ON public.pluggy_accounts;

CREATE POLICY "Users can view own pluggy accounts" ON public.pluggy_accounts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pluggy accounts" ON public.pluggy_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pluggy accounts" ON public.pluggy_accounts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own pluggy accounts" ON public.pluggy_accounts
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for pluggy_transactions
DROP POLICY IF EXISTS "Users can view own pluggy transactions" ON public.pluggy_transactions;
DROP POLICY IF EXISTS "Users can insert own pluggy transactions" ON public.pluggy_transactions;
DROP POLICY IF EXISTS "Users can update own pluggy transactions" ON public.pluggy_transactions;
DROP POLICY IF EXISTS "Users can delete own pluggy transactions" ON public.pluggy_transactions;

CREATE POLICY "Users can view own pluggy transactions" ON public.pluggy_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pluggy transactions" ON public.pluggy_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pluggy transactions" ON public.pluggy_transactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own pluggy transactions" ON public.pluggy_transactions
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for pluggy_sync_logs
DROP POLICY IF EXISTS "Users can view own pluggy sync logs" ON public.pluggy_sync_logs;
DROP POLICY IF EXISTS "Users can insert own pluggy sync logs" ON public.pluggy_sync_logs;

CREATE POLICY "Users can view own pluggy sync logs" ON public.pluggy_sync_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pluggy sync logs" ON public.pluggy_sync_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at on pluggy_items
DROP TRIGGER IF EXISTS update_pluggy_items_updated_at ON public.pluggy_items;
CREATE TRIGGER update_pluggy_items_updated_at BEFORE UPDATE ON public.pluggy_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();




