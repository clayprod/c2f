-- Migration: Audit Logs
-- Description: Create audit logging system for tracking data access and changes

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'SELECT', 'LOGIN', 'LOGOUT', 'ACCESS', 'EXPORT')),
  resource_type TEXT NOT NULL, -- e.g., 'profiles', 'transactions', 'accounts'
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view audit logs
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Users can view their own audit logs (limited fields)
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_user_id UUID,
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action_type,
    resource_type,
    resource_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent,
    p_metadata,
    NOW()
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create audit log from trigger (for automatic logging)
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Convert OLD and NEW to JSONB
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    PERFORM public.create_audit_log(
      COALESCE((OLD.user_id)::UUID, auth.uid()),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      old_data,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('trigger', true)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    PERFORM public.create_audit_log(
      COALESCE((NEW.user_id)::UUID, auth.uid()),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      old_data,
      new_data,
      NULL,
      NULL,
      jsonb_build_object('trigger', true)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    PERFORM public.create_audit_log(
      COALESCE((NEW.user_id)::UUID, auth.uid()),
      'CREATE',
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      new_data,
      NULL,
      NULL,
      jsonb_build_object('trigger', true)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for sensitive tables
-- Note: We'll create triggers selectively to avoid too much overhead

-- Trigger for profiles (only for sensitive fields)
DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for transactions
DROP TRIGGER IF EXISTS audit_transactions_trigger ON public.transactions;
CREATE TRIGGER audit_transactions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for accounts
DROP TRIGGER IF EXISTS audit_accounts_trigger ON public.accounts;
CREATE TRIGGER audit_accounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for billing_subscriptions
DROP TRIGGER IF EXISTS audit_billing_subscriptions_trigger ON public.billing_subscriptions;
CREATE TRIGGER audit_billing_subscriptions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for global_settings (admin changes)
DROP TRIGGER IF EXISTS audit_global_settings_trigger ON public.global_settings;
CREATE TRIGGER audit_global_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for pluggy_items
DROP TRIGGER IF EXISTS audit_pluggy_items_trigger ON public.pluggy_items;
CREATE TRIGGER audit_pluggy_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pluggy_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger for pluggy_accounts
DROP TRIGGER IF EXISTS audit_pluggy_accounts_trigger ON public.pluggy_accounts;
CREATE TRIGGER audit_pluggy_accounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pluggy_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- Function to clean old audit logs (older than 1 year)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit trail for all data access and changes';
COMMENT ON COLUMN public.audit_logs.action_type IS 'Type of action: CREATE, UPDATE, DELETE, SELECT, LOGIN, LOGOUT, ACCESS, EXPORT';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource being accessed/modified (table name)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'ID of the resource being accessed/modified';
COMMENT ON COLUMN public.audit_logs.old_values IS 'Previous values (for UPDATE/DELETE)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'New values (for CREATE/UPDATE)';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context (IP, user agent, etc.)';
COMMENT ON FUNCTION public.create_audit_log IS 'Manually create an audit log entry';
COMMENT ON FUNCTION public.audit_trigger_function IS 'Trigger function for automatic audit logging';




