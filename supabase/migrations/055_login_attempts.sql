-- Migration: Login Attempts Table
-- Description: Track login attempts for rate limiting and security

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts(ip_address, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only allow service role to insert/select (via API routes)
-- Regular users cannot directly access this table
-- Note: Service role bypasses RLS, so we just block all regular access
DROP POLICY IF EXISTS "Service role can manage login attempts" ON public.login_attempts;
CREATE POLICY "Block all access" ON public.login_attempts
  FOR ALL USING (false);

-- Function to clean old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE public.login_attempts IS 'Tracks login attempts for rate limiting and security purposes';
COMMENT ON COLUMN public.login_attempts.email IS 'Email address used in login attempt';
COMMENT ON COLUMN public.login_attempts.ip_address IS 'IP address of the login attempt';
COMMENT ON COLUMN public.login_attempts.attempted_at IS 'Timestamp of the login attempt';
COMMENT ON COLUMN public.login_attempts.success IS 'Whether the login attempt was successful';

