-- Migration: Create global_settings table for admin configurations
-- Description: Store global system settings like SMTP, API keys, AI model configuration, and prompts

CREATE TABLE IF NOT EXISTS public.global_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- SMTP Configuration
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_from_email TEXT,
  -- API Keys
  groq_api_key TEXT,
  openai_api_key TEXT,
  -- AI Model Configuration
  ai_model TEXT CHECK (ai_model IN ('groq', 'openai')),
  ai_model_name TEXT,
  -- Prompts
  advisor_prompt TEXT,
  insights_prompt TEXT,
  -- Stripe Price IDs (can be stored here or in env, but admin can update)
  stripe_price_id_pro TEXT,
  stripe_price_id_business TEXT,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row (will be updated by admin) - only if no row exists
INSERT INTO public.global_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings LIMIT 1);

-- Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can read/write
DROP POLICY IF EXISTS "Only admins can view global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Only admins can update global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Only admins can insert global settings" ON public.global_settings;

CREATE POLICY "Only admins can view global settings" ON public.global_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update global settings" ON public.global_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert global settings" ON public.global_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_global_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_global_settings_updated_at ON public.global_settings;
CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_global_settings_updated_at();

-- Comments
COMMENT ON TABLE public.global_settings IS 'Global system settings configurable by superadmins';
COMMENT ON COLUMN public.global_settings.ai_model IS 'AI provider: groq or openai';
COMMENT ON COLUMN public.global_settings.ai_model_name IS 'Specific model name (e.g., llama-3.1-70b-versatile, gpt-4)';
COMMENT ON COLUMN public.global_settings.advisor_prompt IS 'Custom prompt for advisor chat (unlimited use)';
COMMENT ON COLUMN public.global_settings.insights_prompt IS 'Custom prompt for daily insights (limited to 1/day)';

