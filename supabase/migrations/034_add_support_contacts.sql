-- Migration: Add Support Contact Fields
-- Description: Add support_email and support_whatsapp fields to global_settings table

-- Add support contact fields to global_settings
ALTER TABLE public.global_settings 
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_whatsapp TEXT;

-- Comments
COMMENT ON COLUMN public.global_settings.support_email IS 'Support email address displayed in help center';
COMMENT ON COLUMN public.global_settings.support_whatsapp IS 'Support WhatsApp number displayed in help center (format: +5511999999999)';
