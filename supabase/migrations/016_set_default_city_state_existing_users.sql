-- Migration: Set default city and state for existing users
-- Description: Update existing users to have São Paulo - SP as default location

-- Update all existing users without city/state to São Paulo - SP
UPDATE public.profiles
SET 
  city = 'São Paulo',
  state = 'SP'
WHERE (city IS NULL OR city = '') 
  AND (state IS NULL OR state = '');


