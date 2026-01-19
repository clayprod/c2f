-- Migration: Default Data Setup
-- Description: Function to create default categories and account for new users

-- Function to setup new user with default data
CREATE OR REPLACE FUNCTION setup_new_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if user already has categories
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id) THEN
    -- Insert default categories for the new user
    INSERT INTO public.categories (user_id, name, type, icon, color)
    VALUES
      -- Expenses
      (p_user_id, 'ALIMENTACAO', 'expense', '🍽️', '#FF6B6B'),
      (p_user_id, 'TRANSPORTE', 'expense', '🚗', '#4ECDC4'),
      (p_user_id, 'MORADIA', 'expense', '🏠', '#45B7D1'),
      (p_user_id, 'SAUDE', 'expense', '🏥', '#96CEB4'),
      (p_user_id, 'EDUCACAO', 'expense', '📚', '#FFEAA7'),
      (p_user_id, 'LAZER', 'expense', '🎮', '#DDA0DD'),
      (p_user_id, 'VESTUARIO', 'expense', '👕', '#F8BBD9'),
      (p_user_id, 'SERVICOS', 'expense', '🔧', '#FFB347'),
      (p_user_id, 'IMPOSTOS', 'expense', '💰', '#FF6347'),
      (p_user_id, 'SUPERMERCADO', 'expense', '🛒', '#FF8C00'),
      (p_user_id, 'AGUA', 'expense', '💧', '#00BFFF'),
      (p_user_id, 'ENERGIA', 'expense', '⚡', '#FFD700'),
      (p_user_id, 'GAS', 'expense', '🔥', '#FF4500'),
      (p_user_id, 'INTERNET', 'expense', '🌐', '#9370DB'),
      (p_user_id, 'CELULAR', 'expense', '📱', '#20B2AA'),
      (p_user_id, 'ASSINATURAS', 'expense', '📺', '#FF69B4'),
      (p_user_id, 'BELEZA', 'expense', '💄', '#FF1493'),
      (p_user_id, 'VIAGENS', 'expense', '✈️', '#4169E1'),
      (p_user_id, 'SEGUROS', 'expense', '🛡️', '#32CD32'),
      (p_user_id, 'JUROS', 'expense', '📊', '#DC143C'),
      (p_user_id, 'OUTROS', 'expense', '📌', '#808080'),
      -- Income
      (p_user_id, 'SALARIO', 'income', '💼', '#20B2AA'),
      (p_user_id, 'FREELANCE', 'income', '💻', '#9370DB'),
      (p_user_id, 'INVESTIMENTOS', 'income', '📊', '#00CED1'),
      (p_user_id, 'REEMBOLSOS', 'income', '💸', '#32CD32');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION setup_new_user(UUID) TO authenticated;

-- Optional: Trigger to auto-setup on profile creation
-- (if you want it automatic when user signs up)
CREATE OR REPLACE FUNCTION auto_setup_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM setup_new_user(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table (runs after profile is created)
DROP TRIGGER IF EXISTS trigger_auto_setup_new_user ON public.profiles;
CREATE TRIGGER trigger_auto_setup_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_setup_new_user();