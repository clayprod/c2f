-- Migration: Add SMTP secure option and remove insights_prompt legacy field
-- Description: Add smtp_secure boolean field and remove deprecated insights_prompt

-- Add smtp_secure field
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;

-- Note: insights_prompt column is kept for now to avoid breaking existing data
-- but it's no longer used in the application code
-- To fully remove it later, run:
-- ALTER TABLE public.global_settings DROP COLUMN IF EXISTS insights_prompt;
