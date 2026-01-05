-- Migration: Add city and state fields to profiles table
-- Description: Add city and state fields to user profiles for location tracking

-- Add city and state columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.city IS 'User city';
COMMENT ON COLUMN public.profiles.state IS 'User state (UF)';

