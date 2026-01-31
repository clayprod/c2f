-- Migration: Add assigned_to support to RLS policies
-- Description: Update RLS policies for accounts, credit_card_bills, debts, investments, assets, goals, and receivables
-- to allow users assigned as 'responsible' (assigned_to) to view and update resources even if they are not the owner.

-- ================================================
-- ACCOUNTS - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view own or shared accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts;

CREATE POLICY "Users can view own, shared, or assigned accounts" ON public.accounts
  FOR SELECT USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own accounts" ON public.accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or assigned accounts" ON public.accounts
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Users can delete their own accounts" ON public.accounts
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- CREDIT CARD BILLS - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view own or shared credit_card_bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can insert their own credit_card_bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can update their own credit_card_bills" ON public.credit_card_bills;
DROP POLICY IF EXISTS "Users can delete their own credit_card_bills" ON public.credit_card_bills;

CREATE POLICY "Users can view own, shared, or assigned credit_card_bills" ON public.credit_card_bills
  FOR SELECT USING (
    user_id = auth.uid() 
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid()
    )
    OR account_id IN (
      SELECT id FROM public.accounts 
      WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own credit_card_bills" ON public.credit_card_bills
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own credit_card_bills" ON public.credit_card_bills
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own credit_card_bills" ON public.credit_card_bills
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- DEBTS - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view own or shared debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own or shared debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own or shared debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete their own debts" ON public.debts;

CREATE POLICY "Users can view own, shared, or assigned debts" ON public.debts
  FOR SELECT USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
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

CREATE POLICY "Users can update own, shared, or assigned debts" ON public.debts
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'debts')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own debts" ON public.debts
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- INVESTMENTS - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view own or shared investments" ON public.investments;
DROP POLICY IF EXISTS "Users can insert own or shared investments" ON public.investments;
DROP POLICY IF EXISTS "Users can update own or shared investments" ON public.investments;
DROP POLICY IF EXISTS "Users can delete their own investments" ON public.investments;

CREATE POLICY "Users can view own, shared, or assigned investments" ON public.investments
  FOR SELECT USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
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

CREATE POLICY "Users can update own, shared, or assigned investments" ON public.investments
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'investments')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own investments" ON public.investments
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- ASSETS - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view own or shared assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert own or shared assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update own or shared assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON public.assets;

CREATE POLICY "Users can view own, shared, or assigned assets" ON public.assets
  FOR SELECT USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
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

CREATE POLICY "Users can update own, shared, or assigned assets" ON public.assets
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'assets')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own assets" ON public.assets
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- GOALS - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view own or shared goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert own or shared goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update own or shared goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;

CREATE POLICY "Users can view own, shared, or assigned goals" ON public.goals
  FOR SELECT USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
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

CREATE POLICY "Users can update own, shared, or assigned goals" ON public.goals
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM public.account_members 
      WHERE member_id = auth.uid() 
      AND (permissions->'goals')::jsonb->>'edit' = 'true'
    )
  );

CREATE POLICY "Users can delete their own goals" ON public.goals
  FOR DELETE USING (user_id = auth.uid());

-- ================================================
-- RECEIVABLES - Update policies for assigned_to support
-- ================================================

DROP POLICY IF EXISTS "Users can view their own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can insert their own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can update their own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can delete their own receivables" ON public.receivables;

CREATE POLICY "Users can view own or assigned receivables" ON public.receivables
  FOR SELECT USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Users can insert their own receivables" ON public.receivables
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or assigned receivables" ON public.receivables
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Users can delete their own receivables" ON public.receivables
  FOR DELETE USING (user_id = auth.uid());

-- Comments for documentation
COMMENT ON POLICY "Users can view own, shared, or assigned accounts" ON public.accounts IS 'Allow users to view their own accounts, accounts shared with them, or accounts where they are assigned as responsible';
COMMENT ON POLICY "Users can update own or assigned accounts" ON public.accounts IS 'Allow users to update their own accounts or accounts where they are assigned as responsible';
COMMENT ON POLICY "Users can view own, shared, or assigned debts" ON public.debts IS 'Allow users to view their own debts, debts shared with them, or debts where they are assigned as responsible';
COMMENT ON POLICY "Users can update own, shared, or assigned debts" ON public.debts IS 'Allow users to update their own debts, debts shared with them, or debts where they are assigned as responsible';
COMMENT ON POLICY "Users can view own, shared, or assigned investments" ON public.investments IS 'Allow users to view their own investments, investments shared with them, or investments where they are assigned as responsible';
COMMENT ON POLICY "Users can update own, shared, or assigned investments" ON public.investments IS 'Allow users to update their own investments, investments shared with them, or investments where they are assigned as responsible';
COMMENT ON POLICY "Users can view own, shared, or assigned assets" ON public.assets IS 'Allow users to view their own assets, assets shared with them, or assets where they are assigned as responsible';
COMMENT ON POLICY "Users can update own, shared, or assigned assets" ON public.assets IS 'Allow users to update their own assets, assets shared with them, or assets where they are assigned as responsible';
COMMENT ON POLICY "Users can view own, shared, or assigned goals" ON public.goals IS 'Allow users to view their own goals, goals shared with them, or goals where they are assigned as responsible';
COMMENT ON POLICY "Users can update own, shared, or assigned goals" ON public.goals IS 'Allow users to update their own goals, goals shared with them, or goals where they are assigned as responsible';
COMMENT ON POLICY "Users can view own or assigned receivables" ON public.receivables IS 'Allow users to view their own receivables or receivables where they are assigned as responsible';
COMMENT ON POLICY "Users can update own or assigned receivables" ON public.receivables IS 'Allow users to update their own receivables or receivables where they are assigned as responsible';
