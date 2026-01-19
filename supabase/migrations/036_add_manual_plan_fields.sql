-- Migration: Add manual plan management fields
-- Description: Add fields to support admin-granted plans and update RLS policies

-- Add columns for manual plan management
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP WITH TIME ZONE;

-- Make stripe_subscription_id nullable for manual plans (they may not have Stripe subscription initially)
ALTER TABLE public.billing_subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL;

-- Update RLS policies for admins to manage manual subscriptions
-- Allow admins to INSERT manual subscriptions
DROP POLICY IF EXISTS "Admins can insert manual subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Admins can insert manual subscriptions" ON public.billing_subscriptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND is_manual = true
  );

-- Allow admins to UPDATE manual subscriptions
DROP POLICY IF EXISTS "Admins can update manual subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Admins can update manual subscriptions" ON public.billing_subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND is_manual = true
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND is_manual = true
  );

-- Allow admins to DELETE manual subscriptions
DROP POLICY IF EXISTS "Admins can delete manual subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Admins can delete manual subscriptions" ON public.billing_subscriptions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    AND is_manual = true
  );

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_is_manual ON public.billing_subscriptions(is_manual);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_granted_by ON public.billing_subscriptions(granted_by);
