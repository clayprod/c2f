-- Add Pluggy settings columns to global_settings
ALTER TABLE global_settings
ADD COLUMN IF NOT EXISTS pluggy_client_id TEXT,
ADD COLUMN IF NOT EXISTS pluggy_client_secret TEXT,
ADD COLUMN IF NOT EXISTS pluggy_enabled BOOLEAN DEFAULT false;

-- Add categorization prompt for AI-powered transaction categorization
ALTER TABLE global_settings
ADD COLUMN IF NOT EXISTS categorization_prompt TEXT;

COMMENT ON COLUMN global_settings.pluggy_client_id IS 'Pluggy API Client ID for Open Finance integration';
COMMENT ON COLUMN global_settings.pluggy_client_secret IS 'Pluggy API Client Secret';
COMMENT ON COLUMN global_settings.pluggy_enabled IS 'Enable/disable Pluggy integration for superadmin testing';
COMMENT ON COLUMN global_settings.categorization_prompt IS 'Custom prompt for AI transaction categorization';
