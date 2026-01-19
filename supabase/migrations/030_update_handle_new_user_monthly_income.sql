-- Migration: Update handle_new_user function to include monthly_income_cents
-- Description: Update the function that creates profiles on signup to include monthly_income_cents from metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
