-- Migration: Add is_active field to categories
-- Description: Add is_active boolean field to allow deactivating categories without deleting them

-- Add is_active column to categories table
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Create index for performance when filtering active categories
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(user_id, is_active);

-- Update existing categories to be active by default (already handled by DEFAULT, but explicit for safety)
UPDATE public.categories
SET is_active = true
WHERE is_active IS NULL;


