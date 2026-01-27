-- Migration: Enhanced RLS Policies for Encrypted Data
-- Description: Add enhanced RLS policies to ensure proper access control for encrypted data

-- Ensure RLS is enabled on all sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Enhanced RLS policy for profiles_decrypted view
-- Users can only see their own decrypted data
DROP POLICY IF EXISTS "Users can view own decrypted profile" ON public.profiles_decrypted;
CREATE POLICY "Users can view own decrypted profile" ON public.profiles_decrypted
  FOR SELECT USING (id = auth.uid());

-- Admins can view all profiles (with audit trail)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles_decrypted;
CREATE POLICY "Admins can view all profiles" ON public.profiles_decrypted
  FOR SELECT USING (is_admin(auth.uid()));

-- Enhanced RLS policy for transactions_decrypted view
DROP POLICY IF EXISTS "Users can view own decrypted transactions" ON public.transactions_decrypted;
CREATE POLICY "Users can view own decrypted transactions" ON public.transactions_decrypted
  FOR SELECT USING (user_id = auth.uid());

-- Enhanced RLS policy for accounts_decrypted view
DROP POLICY IF EXISTS "Users can view own decrypted accounts" ON public.accounts_decrypted;
CREATE POLICY "Users can view own decrypted accounts" ON public.accounts_decrypted
  FOR SELECT USING (user_id = auth.uid());

-- Enhanced RLS policy for pluggy_accounts_decrypted view
DROP POLICY IF EXISTS "Users can view own decrypted pluggy accounts" ON public.pluggy_accounts_decrypted;
CREATE POLICY "Users can view own decrypted pluggy accounts" ON public.pluggy_accounts_decrypted
  FOR SELECT USING (user_id = auth.uid());

-- Enhanced RLS policy for global_settings_decrypted view
-- Only admins can view decrypted global settings
DROP POLICY IF EXISTS "Only admins can view decrypted global settings" ON public.global_settings_decrypted;
CREATE POLICY "Only admins can view decrypted global settings" ON public.global_settings_decrypted
  FOR SELECT USING (is_admin(auth.uid()));

-- Function to log admin access to encrypted data (for audit)
CREATE OR REPLACE FUNCTION log_admin_data_access(
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_reason TEXT DEFAULT NULL
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
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    'ACCESS',
    p_resource_type,
    p_resource_id,
    jsonb_build_object('reason', p_reason, 'admin_access', true),
    NOW()
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy to prevent direct access to encrypted columns (force use of views)
-- Note: This is handled by application code, but we add a comment for documentation
COMMENT ON COLUMN public.profiles.email_encrypted IS 'Encrypted - use profiles_decrypted view to access decrypted data';
COMMENT ON COLUMN public.profiles.full_name_encrypted IS 'Encrypted - use profiles_decrypted view to access decrypted data';
COMMENT ON COLUMN public.transactions.description_encrypted IS 'Encrypted - use transactions_decrypted view to access decrypted data';
COMMENT ON COLUMN public.accounts.name_encrypted IS 'Encrypted - use accounts_decrypted view to access decrypted data';
COMMENT ON COLUMN public.global_settings.smtp_password_encrypted IS 'Encrypted - use global_settings_decrypted view to access decrypted data';

-- Ensure audit_logs policies are correct
-- Users can view their own audit logs (limited)
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (is_admin(auth.uid()));

-- Comments
COMMENT ON FUNCTION is_admin(UUID) IS 'Check if user has admin role';
COMMENT ON FUNCTION log_admin_data_access IS 'Log when admin accesses encrypted data for audit purposes';





