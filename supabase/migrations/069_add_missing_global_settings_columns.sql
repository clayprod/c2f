-- Migration: Add Missing Global Settings Columns
-- Description: Add columns that were referenced in code but missing from database

-- Add advisor limits columns
ALTER TABLE public.global_settings 
  ADD COLUMN IF NOT EXISTS advisor_limit_pro INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS advisor_limit_premium INTEGER DEFAULT 100;

-- Add smtp_secure column
ALTER TABLE public.global_settings 
  ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;

-- Comments
COMMENT ON COLUMN public.global_settings.advisor_limit_pro IS 'Monthly limit for AI Advisor calls for Pro plan';
COMMENT ON COLUMN public.global_settings.advisor_limit_premium IS 'Monthly limit for AI Advisor calls for Premium plan';
COMMENT ON COLUMN public.global_settings.smtp_secure IS 'Use TLS/SSL for SMTP connection';

-- Recreate the decrypted view to include new columns
DROP VIEW IF EXISTS public.global_settings_decrypted;
CREATE VIEW public.global_settings_decrypted AS
SELECT
  id,
  smtp_host,
  smtp_port,
  smtp_user,
  decrypt_sensitive_data(smtp_password_encrypted) AS smtp_password,
  smtp_from_email,
  smtp_secure,
  decrypt_sensitive_data(groq_api_key_encrypted) AS groq_api_key,
  decrypt_sensitive_data(openai_api_key_encrypted) AS openai_api_key,
  ai_model,
  ai_model_name,
  advisor_prompt,
  tips_prompt,
  categorization_prompt,
  tips_enabled,
  chat_max_tokens,
  session_ttl_minutes,
  stripe_price_id_pro,
  stripe_price_id_business,
  advisor_limit_pro,
  advisor_limit_premium,
  support_email,
  support_whatsapp,
  evolution_api_url,
  decrypt_sensitive_data(evolution_api_key_encrypted) AS evolution_api_key,
  evolution_instance_name,
  decrypt_sensitive_data(evolution_webhook_secret_encrypted) AS evolution_webhook_secret,
  decrypt_sensitive_data(n8n_api_key_encrypted) AS n8n_api_key,
  whatsapp_enabled,
  pluggy_client_id,
  decrypt_sensitive_data(pluggy_client_secret_encrypted) AS pluggy_client_secret,
  pluggy_enabled,
  plan_features_free,
  plan_features_pro,
  plan_features_premium,
  plan_display_config,
  created_at,
  updated_at
FROM public.global_settings;

-- Grant access to view (admin only via RLS)
GRANT SELECT ON public.global_settings_decrypted TO authenticated;

COMMENT ON VIEW public.global_settings_decrypted IS 'View with decrypted global settings for admin use';
