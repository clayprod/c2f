-- Migration: Shared Access RLS Policies
-- Description: Update RLS policies for main tables to support shared account access

-- ================================================
-- TRANSACTIONS - Update policies for shared access
-- ================================================

-- Drop existing policies for transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;

-- Create new policies with shared access support
CREATE POLICY "Users can view own or shared transactions" ON public.transactions
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (
        permissions->'transactions' = 'true'::jsonb 
        OR (permissions->'transactions')::jsonb->>'view' = 'true'
      )
    )
  );

CREATE POLICY "Users can insert own or shared transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'transactions')::jsonb->>'create' = 'true'
    )
  );

CREATE POLICY "Users can update own or shared transactions" ON public.transactions
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'transactions')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete own or shared transactions" ON public.transactions
  FOR DELETE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'transactions')::jsonb->>'delete' = 'true'
    )
  );

-- ================================================
-- ACCOUNTS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts;

CREATE POLICY "Users can view own or shared accounts" ON public.accounts
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own accounts" ON public.accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own accounts" ON public.accounts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own accounts" ON public.accounts
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- CATEGORIES - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

CREATE POLICY "Users can view own or shared categories" ON public.categories
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own categories" ON public.categories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own categories" ON public.categories
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own categories" ON public.categories
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- BUDGETS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete their own budgets" ON public.budgets;

CREATE POLICY "Users can view own or shared budgets" ON public.budgets
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (
        permissions->'budgets' = 'true'::jsonb 
        OR (permissions->'budgets')::jsonb->>'view' = 'true'
      )
    )
  );

CREATE POLICY "Users can insert own or shared budgets" ON public.budgets
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'budgets')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can update own or shared budgets" ON public.budgets
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'budgets')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete own or shared budgets" ON public.budgets
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- GOALS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;

CREATE POLICY "Users can view own or shared goals" ON public.goals
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (
        permissions->'goals' = 'true'::jsonb 
        OR (permissions->'goals')::jsonb->>'view' = 'true'
      )
    )
  );

CREATE POLICY "Users can insert own or shared goals" ON public.goals
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'goals')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can update own or shared goals" ON public.goals
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'goals')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own goals" ON public.goals
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- DEBTS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert their own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update their own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete their own debts" ON public.debts;

CREATE POLICY "Users can view own or shared debts" ON public.debts
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (
        permissions->'debts' = 'true'::jsonb 
        OR (permissions->'debts')::jsonb->>'view' = 'true'
      )
    )
  );

CREATE POLICY "Users can insert own or shared debts" ON public.debts
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'debts')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can update own or shared debts" ON public.debts
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'debts')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own debts" ON public.debts
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- INVESTMENTS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert their own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update their own investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete their own investments" ON public.investments;

CREATE POLICY "Users can view own or shared investments" ON public.investments
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (
        permissions->'investments' = 'true'::jsonb 
        OR (permissions->'investments')::jsonb->>'view' = 'true'
      )
    )
  );

CREATE POLICY "Users can insert own or shared investments" ON public.investments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'investments')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can update own or shared investments" ON public.investments
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'investments')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own investments" ON public.investments
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- ASSETS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON public.assets;

CREATE POLICY "Users can view own or shared assets" ON public.assets
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (
        permissions->'assets' = 'true'::jsonb 
        OR (permissions->'assets')::jsonb->>'view' = 'true'
      )
    )
  );

CREATE POLICY "Users can insert own or shared assets" ON public.assets
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'assets')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can update own or shared assets" ON public.assets
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'assets')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own assets" ON public.assets
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- CREDIT CARD BILLS - Update policies for shared access
-- ================================================

DROP POLICY IF EXISTS "Users can view their own credit_card_bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can insert their own credit_card_bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can update their own credit_card_bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can delete their own credit_card_bills" ON public.credit_card_bills;

CREATE POLICY "Users can view own or shared credit_card_bills" ON public.credit_card_bills
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own credit_card_bills" ON public.credit_card_bills
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own credit_card_bills" ON public.credit_card_bills
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own credit_card_bills" ON public.credit_card_bills
  FOR DELETE USING (user_id = auth.uid());

-- Comments
COMMENT ON POLICY "Users can view own or shared transactions" ON public.transactions IS 'Allow users to view their own transactions or transactions from accounts shared with them (with view permission)';
COMMENT ON POLICY "Users can insert own or shared transactions" ON public.transactions IS 'Allow users to create transactions on their own accounts or on shared accounts with create permission';
COMMENT ON POLICY "Users can update own or shared transactions" ON public.transactions IS 'Allow users to update their own transactions or transactions from shared accounts with edit permission';
COMMENT ON POLICY "Users can delete own or shared transactions" ON public.transactions IS 'Allow users to delete their own transactions or transactions from shared accounts with delete permission';
