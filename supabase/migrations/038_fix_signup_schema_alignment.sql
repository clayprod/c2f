-- Migration: Fix signup schema alignment
-- Description: Ensure required columns/tables exist for handle_new_user() to avoid 500 errors on /auth/v1/signup

-- 1) Ensure profiles has required columns used during signup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS monthly_income_cents BIGINT;

-- Normalize legacy gender values to keep data consistent.
-- Older UI versions used 'male'/'female'; map to the closest current values.
UPDATE public.profiles
SET gender = CASE gender
  WHEN 'male' THEN 'male_cis'
  WHEN 'female' THEN 'female_cis'
  ELSE gender
END
WHERE gender IN ('male', 'female');

-- Ensure gender CHECK constraint exists (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_check
      CHECK (gender IS NULL OR gender IN (
        'male_cis',
        'male_trans',
        'female_cis',
        'female_trans',
        'non_binary',
        'other',
        'prefer_not_to_say'
      ));
  END IF;
END $$;

-- 2) Ensure notifications table exists (used by newer handle_new_user)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read ON public.notifications(user_id, type, read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- 3) Make handle_new_user consistent with current app metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    city,
    state,
    cep,
    birth_date,
    gender,
    monthly_income_cents
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'cep', ''),
    CASE
      WHEN NULLIF(NEW.raw_user_meta_data->>'birth_date', '') IS NOT NULL THEN
        (NEW.raw_user_meta_data->>'birth_date')::DATE
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'gender', ''),
    CASE
      WHEN NULLIF(NEW.raw_user_meta_data->>'monthly_income_cents', '') IS NOT NULL THEN
        (NEW.raw_user_meta_data->>'monthly_income_cents')::BIGINT
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    cep = EXCLUDED.cep,
    birth_date = EXCLUDED.birth_date,
    gender = EXCLUDED.gender,
    monthly_income_cents = EXCLUDED.monthly_income_cents;

  -- Ensure default data exists for the user (categories + default account).
  -- This is intentionally called here (not only via profiles trigger) because the
  -- profile insert above may hit ON CONFLICT DO UPDATE and not fire AFTER INSERT triggers.
  PERFORM public.setup_new_user(NEW.id);

  -- Welcome notification (safe if table exists)
  INSERT INTO public.notifications (user_id, title, message, type, link, read)
  VALUES (
    NEW.id,
    'Bem-vindo ao c2Finance! 🎉',
    'Explore nossa Central de Ajuda para aprender como usar todas as funcionalidades do sistema e tirar o máximo proveito da plataforma.',
    'info',
    '/app/help',
    FALSE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

