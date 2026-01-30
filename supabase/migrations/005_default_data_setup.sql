-- Migration: Default Data Setup
-- Description: Function to create default categories and account for new users

-- Function to setup new user with default data
CREATE OR REPLACE FUNCTION setup_new_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if user already has categories
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id) THEN
    -- Insert default categories for the new user
    INSERT INTO public.categories (user_id, name, type, icon, color, expense_type)
    VALUES
      -- Expenses (Variable - more flexible for adjustments)
      (p_user_id, 'ALIMENTAÇÃO', 'expense', '🍽️', '#FF6B6B', 'variable'),
      (p_user_id, 'TRANSPORTE', 'expense', '🚗', '#4ECDC4', 'variable'),
      (p_user_id, 'SAÚDE', 'expense', '🏥', '#96CEB4', 'variable'),
      (p_user_id, 'EDUCAÇÃO', 'expense', '📚', '#FFEAA7', 'variable'),
      (p_user_id, 'LAZER', 'expense', '🎮', '#DDA0DD', 'variable'),
      (p_user_id, 'VESTUÁRIO', 'expense', '👕', '#F8BBD9', 'variable'),
      (p_user_id, 'SERVIÇOS', 'expense', '🔧', '#FFB347', 'variable'),
      (p_user_id, 'IMPOSTOS', 'expense', '💰', '#FF6347', 'variable'),
      (p_user_id, 'SUPERMERCADO', 'expense', '🛒', '#FF8C00', 'variable'),
      (p_user_id, 'ÁGUA', 'expense', '💧', '#00BFFF', 'variable'),
      (p_user_id, 'ENERGIA', 'expense', '⚡', '#FFD700', 'variable'),
      (p_user_id, 'GÁS', 'expense', '🔥', '#FF4500', 'variable'),
      (p_user_id, 'CELULAR', 'expense', '📱', '#20B2AA', 'variable'),
      (p_user_id, 'BELEZA', 'expense', '💄', '#FF1493', 'variable'),
      (p_user_id, 'VIAGENS', 'expense', '✈️', '#4169E1', 'variable'),
      (p_user_id, 'JUROS', 'expense', '📊', '#DC143C', 'variable'),
      (p_user_id, 'OUTROS', 'expense', '📌', '#808080', 'variable'),
      -- Expenses (Fixed - essential, recurring costs)
      (p_user_id, 'MORADIA', 'expense', '🏠', '#45B7D1', 'fixed'),
      (p_user_id, 'INTERNET', 'expense', '🌐', '#9370DB', 'fixed'),
      (p_user_id, 'ASSINATURAS', 'expense', '📺', '#FF69B4', 'fixed'),
      (p_user_id, 'SEGUROS', 'expense', '🛡️', '#32CD32', 'fixed'),
      -- Income
      (p_user_id, 'SALÁRIO', 'income', '💼', '#20B2AA', NULL),
      (p_user_id, 'FREELANCE', 'income', '💻', '#9370DB', NULL),
      (p_user_id, 'INVESTIMENTOS', 'income', '📊', '#00CED1', NULL),
      (p_user_id, 'REEMBOLSOS', 'income', '💸', '#32CD32', NULL);
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