-- Migration: Add Welcome Notification for New Users
-- Description: Update handle_new_user function to create a welcome notification directing users to the help center

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, city, state, birth_date, gender, monthly_income_cents)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL),
    COALESCE(NEW.raw_user_meta_data->>'state', NULL),
    CASE 
      WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL AND NEW.raw_user_meta_data->>'birth_date' != '' THEN
        (NEW.raw_user_meta_data->>'birth_date')::DATE
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'gender', NULL),
    CASE 
      WHEN NEW.raw_user_meta_data->>'monthly_income_cents' IS NOT NULL THEN
        (NEW.raw_user_meta_data->>'monthly_income_cents')::BIGINT
      ELSE NULL
    END
  );

  -- Ensure default data exists for the user (categories + default account)
  PERFORM public.setup_new_user(NEW.id);

  -- Create welcome notification directing to help center
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

-- Comments
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile and welcome notification when a new user signs up';
