-- Migration: Add Encrypted Fields to Global Settings
-- Description: Add encrypted columns for sensitive credentials in global_settings

-- Add encrypted columns for sensitive credentials
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS smtp_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_client_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS groq_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS openai_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS evolution_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS evolution_webhook_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS n8n_api_key_encrypted TEXT;

-- Function to migrate existing data to encrypted columns
CREATE OR REPLACE FUNCTION migrate_global_settings_to_encrypted()
RETURNS void AS $$
DECLARE
  settings_record RECORD;
BEGIN
  -- Migrate existing data
  FOR settings_record IN 
    SELECT id, smtp_password, pluggy_client_secret, groq_api_key, openai_api_key, 
           evolution_api_key, evolution_webhook_secret, n8n_api_key 
    FROM public.global_settings
  LOOP
    UPDATE public.global_settings
    SET
      smtp_password_encrypted = encrypt_sensitive_data(settings_record.smtp_password),
      pluggy_client_secret_encrypted = encrypt_sensitive_data(settings_record.pluggy_client_secret),
      groq_api_key_encrypted = encrypt_sensitive_data(settings_record.groq_api_key),
      openai_api_key_encrypted = encrypt_sensitive_data(settings_record.openai_api_key),
      evolution_api_key_encrypted = encrypt_sensitive_data(settings_record.evolution_api_key),
      evolution_webhook_secret_encrypted = encrypt_sensitive_data(settings_record.evolution_webhook_secret),
      n8n_api_key_encrypted = encrypt_sensitive_data(settings_record.n8n_api_key)
    WHERE id = settings_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function to encrypt on insert/update
CREATE OR REPLACE FUNCTION encrypt_global_settings_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Encrypt sensitive fields on INSERT or UPDATE
  IF NEW.smtp_password IS NOT NULL AND NEW.smtp_password != '' THEN
    NEW.smtp_password_encrypted := encrypt_sensitive_data(NEW.smtp_password);
  END IF;
  
  IF NEW.pluggy_client_secret IS NOT NULL AND NEW.pluggy_client_secret != '' THEN
    NEW.pluggy_client_secret_encrypted := encrypt_sensitive_data(NEW.pluggy_client_secret);
  END IF;
  
  IF NEW.groq_api_key IS NOT NULL AND NEW.groq_api_key != '' THEN
    NEW.groq_api_key_encrypted := encrypt_sensitive_data(NEW.groq_api_key);
  END IF;
  
  IF NEW.openai_api_key IS NOT NULL AND NEW.openai_api_key != '' THEN
    NEW.openai_api_key_encrypted := encrypt_sensitive_data(NEW.openai_api_key);
  END IF;
  
  IF NEW.evolution_api_key IS NOT NULL AND NEW.evolution_api_key != '' THEN
    NEW.evolution_api_key_encrypted := encrypt_sensitive_data(NEW.evolution_api_key);
  END IF;
  
  IF NEW.evolution_webhook_secret IS NOT NULL AND NEW.evolution_webhook_secret != '' THEN
    NEW.evolution_webhook_secret_encrypted := encrypt_sensitive_data(NEW.evolution_webhook_secret);
  END IF;
  
  IF NEW.n8n_api_key IS NOT NULL AND NEW.n8n_api_key != '' THEN
    NEW.n8n_api_key_encrypted := encrypt_sensitive_data(NEW.n8n_api_key);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (will encrypt when using original columns)
DROP TRIGGER IF EXISTS encrypt_global_settings_trigger ON public.global_settings;
CREATE TRIGGER encrypt_global_settings_trigger
  BEFORE INSERT OR UPDATE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_global_settings_trigger();

-- Create view for decrypted global settings (admin only)
CREATE OR REPLACE VIEW public.global_settings_decrypted AS
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

-- Comments
COMMENT ON COLUMN public.global_settings.smtp_password_encrypted IS 'Encrypted SMTP password';
COMMENT ON COLUMN public.global_settings.pluggy_client_secret_encrypted IS 'Encrypted Pluggy client secret';
COMMENT ON COLUMN public.global_settings.groq_api_key_encrypted IS 'Encrypted Groq API key';
COMMENT ON COLUMN public.global_settings.openai_api_key_encrypted IS 'Encrypted OpenAI API key';
COMMENT ON COLUMN public.global_settings.evolution_api_key_encrypted IS 'Encrypted Evolution API key';
COMMENT ON COLUMN public.global_settings.evolution_webhook_secret_encrypted IS 'Encrypted Evolution webhook secret';
COMMENT ON COLUMN public.global_settings.n8n_api_key_encrypted IS 'Encrypted n8n API key';
COMMENT ON VIEW public.global_settings_decrypted IS 'View with decrypted global settings for admin use';

-- Note: After migration is complete and verified, you can drop the original columns:
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS smtp_password;
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS pluggy_client_secret;
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS groq_api_key;
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS openai_api_key;
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS evolution_api_key;
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS evolution_webhook_secret;
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS n8n_api_key;





