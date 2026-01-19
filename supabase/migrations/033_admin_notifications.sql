-- Migration: Admin Notifications Schema
-- Description: Create tables for admin notifications with user segmentation

-- 1. Admin Notifications table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
  link TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  target_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Admin Notification Segments table
CREATE TABLE IF NOT EXISTS public.admin_notification_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID REFERENCES public.admin_notifications(id) ON DELETE CASCADE NOT NULL,
  gender TEXT[],
  states TEXT[],
  cities TEXT[],
  age_min INTEGER,
  age_max INTEGER,
  income_min_cents BIGINT,
  income_max_cents BIGINT,
  plan_ids TEXT[],
  CONSTRAINT unique_notification_segment UNIQUE(notification_id)
);

-- 3. Admin Notification Recipients table
CREATE TABLE IF NOT EXISTS public.admin_notification_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID REFERENCES public.admin_notifications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_notification_recipient UNIQUE(notification_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_by ON public.admin_notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON public.admin_notifications(status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_scheduled ON public.admin_notifications(status, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_admin_notification_segments_notification_id ON public.admin_notification_segments(notification_id);
CREATE INDEX IF NOT EXISTS idx_admin_notification_recipients_notification_id ON public.admin_notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_admin_notification_recipients_user_id ON public.admin_notification_recipients(user_id);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_notifications (only admins can access)
DROP POLICY IF EXISTS "Admins can view admin notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Admins can insert admin notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Admins can update admin notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Admins can delete admin notifications" ON public.admin_notifications;

CREATE POLICY "Admins can view admin notifications" ON public.admin_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert admin notifications" ON public.admin_notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update admin notifications" ON public.admin_notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete admin notifications" ON public.admin_notifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for admin_notification_segments (only admins can access)
DROP POLICY IF EXISTS "Admins can view admin notification segments" ON public.admin_notification_segments;
DROP POLICY IF EXISTS "Admins can insert admin notification segments" ON public.admin_notification_segments;
DROP POLICY IF EXISTS "Admins can update admin notification segments" ON public.admin_notification_segments;
DROP POLICY IF EXISTS "Admins can delete admin notification segments" ON public.admin_notification_segments;

CREATE POLICY "Admins can view admin notification segments" ON public.admin_notification_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert admin notification segments" ON public.admin_notification_segments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update admin notification segments" ON public.admin_notification_segments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete admin notification segments" ON public.admin_notification_segments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for admin_notification_recipients (admins can view, users can view their own)
DROP POLICY IF EXISTS "Admins can view admin notification recipients" ON public.admin_notification_recipients;
DROP POLICY IF EXISTS "Users can view own admin notification recipients" ON public.admin_notification_recipients;
DROP POLICY IF EXISTS "Admins can insert admin notification recipients" ON public.admin_notification_recipients;

CREATE POLICY "Admins can view admin notification recipients" ON public.admin_notification_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own admin notification recipients" ON public.admin_notification_recipients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can insert admin notification recipients" ON public.admin_notification_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_admin_notifications_updated_at ON public.admin_notifications;
CREATE TRIGGER update_admin_notifications_updated_at BEFORE UPDATE ON public.admin_notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.admin_notifications IS 'Admin-created notifications for users';
COMMENT ON COLUMN public.admin_notifications.created_by IS 'Admin user who created the notification';
COMMENT ON COLUMN public.admin_notifications.target_count IS 'Estimated number of users who will receive this notification';
COMMENT ON TABLE public.admin_notification_segments IS 'Segmentation criteria for admin notifications';
COMMENT ON COLUMN public.admin_notification_segments.gender IS 'Array of gender values or NULL for all';
COMMENT ON COLUMN public.admin_notification_segments.states IS 'Array of state UFs or NULL for all';
COMMENT ON COLUMN public.admin_notification_segments.cities IS 'Array of city names or NULL for all';
COMMENT ON COLUMN public.admin_notification_segments.age_min IS 'Minimum age in years or NULL';
COMMENT ON COLUMN public.admin_notification_segments.age_max IS 'Maximum age in years or NULL';
COMMENT ON COLUMN public.admin_notification_segments.income_min_cents IS 'Minimum monthly income in cents or NULL';
COMMENT ON COLUMN public.admin_notification_segments.income_max_cents IS 'Maximum monthly income in cents or NULL';
COMMENT ON COLUMN public.admin_notification_segments.plan_ids IS 'Array of plan IDs (free, pro, premium) or NULL for all';
COMMENT ON TABLE public.admin_notification_recipients IS 'Record of which users received admin notifications';
