-- Migration: Add image_url to goals table
-- Description: Add image_url field to allow goals to have cover images

ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS image_position TEXT DEFAULT 'center';

-- Comment on columns
COMMENT ON COLUMN public.goals.image_url IS 'URL da imagem de capa do objetivo armazenada no Supabase Storage';
COMMENT ON COLUMN public.goals.image_position IS 'Posição da imagem na capa (center, top, bottom, left, right, etc)';

