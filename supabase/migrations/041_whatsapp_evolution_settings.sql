-- Migration: Add WhatsApp Evolution API settings to global_settings
-- This enables the WhatsApp integration via Evolution API for premium users

-- Add Evolution API configuration columns
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT,
ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
ADD COLUMN IF NOT EXISTS evolution_webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS n8n_api_key TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN public.global_settings.evolution_api_url IS 'Base URL of the Evolution API (e.g., https://evolution.example.com)';
COMMENT ON COLUMN public.global_settings.evolution_api_key IS 'Global API Key for Evolution API authentication';
COMMENT ON COLUMN public.global_settings.evolution_instance_name IS 'Name of the WhatsApp instance configured in Evolution API';
COMMENT ON COLUMN public.global_settings.evolution_webhook_secret IS 'Secret for validating webhooks from Evolution API';
COMMENT ON COLUMN public.global_settings.n8n_api_key IS 'API Key for n8n workflow authentication';
COMMENT ON COLUMN public.global_settings.whatsapp_enabled IS 'Enable/disable WhatsApp integration globally';
