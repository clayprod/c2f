-- Migration: Add birth_date and gender fields to profiles table
-- Description: Add birth_date and gender fields to user profiles

-- Add birth_date and gender columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male_cis', 'male_trans', 'female_cis', 'female_trans', 'non_binary', 'other', 'prefer_not_to_say'));

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.birth_date IS 'User birth date';
COMMENT ON COLUMN public.profiles.gender IS 'User gender identity: male_cis, male_trans, female_cis, female_trans, non_binary, other, prefer_not_to_say';
