-- Migration: Allow users to insert their own notifications
-- Description:
--   The notifications table previously had SELECT/UPDATE/DELETE policies only.
--   Without an INSERT policy, app-created notifications (e.g. invite accepted) would fail under RLS.

DO $$
BEGIN
  -- Ensure table exists before touching policies
  PERFORM 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'notifications';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
  CREATE POLICY "Users can insert own notifications" ON public.notifications
    FOR INSERT WITH CHECK (user_id = auth.uid());
END $$;

