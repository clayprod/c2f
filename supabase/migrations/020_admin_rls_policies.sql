-- Migration: Admin RLS policies for data aggregation
-- Description: Allow admins to read aggregated data from transactions, profiles, etc. for analytics

-- Policy: Admins can view all profiles (for user count and demographics)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR -- User can view own profile
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can view all transactions (for aggregated analytics only)
-- Note: This allows admins to see transactions for aggregation, but they should only use aggregated data
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT USING (
    user_id = auth.uid() OR -- User can view own transactions
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can view all accounts (for analytics)
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
CREATE POLICY "Admins can view all accounts" ON public.accounts
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can view all categories (for analytics)
DROP POLICY IF EXISTS "Admins can view all categories" ON public.categories;
CREATE POLICY "Admins can view all categories" ON public.categories
  FOR SELECT USING (
    user_id = auth.uid() OR user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can view billing subscriptions (for plan distribution stats)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.billing_subscriptions
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can view billing customers (for analytics)
DROP POLICY IF EXISTS "Admins can view all customers" ON public.billing_customers;
CREATE POLICY "Admins can view all customers" ON public.billing_customers
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

