-- Migration: Add institution_logo to pluggy_accounts
-- Description: Add institution_logo field to store the URL of the institution logo from Pluggy CDN

ALTER TABLE public.pluggy_accounts
ADD COLUMN IF NOT EXISTS institution_logo TEXT;

COMMENT ON COLUMN public.pluggy_accounts.institution_logo IS 'URL do logo da instituição financeira obtido do CDN do Pluggy (formato: https://cdn.pluggy.ai/assets/connector-icons/{connector_id}.svg)';


