-- Migration: Remove FINANCIAMENTOS category
-- Description: Remove FINANCIAMENTOS category from default setup and existing users
-- This category will now come from debts instead

-- Note: 
-- - Transactions with this category will have category_id set to NULL (ON DELETE SET NULL)
-- - Budgets with this category will be automatically deleted (ON DELETE CASCADE)

-- First, remove FINANCIAMENTOS categories from existing users
DELETE FROM public.categories 
WHERE name = 'FINANCIAMENTOS' AND type = 'expense';

-- Update setup_new_user function to remove FINANCIAMENTOS
CREATE OR REPLACE FUNCTION setup_new_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if user already has categories
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id) THEN
    -- Insert default categories
    INSERT INTO public.categories (user_id, name, type, icon, color) VALUES
      -- Expenses
      (p_user_id, 'ALIMENTAÇÃO', 'expense', '🍽️', '#FF6B6B'),
      (p_user_id, 'TRANSPORTE', 'expense', '🚗', '#4ECDC4'),
      (p_user_id, 'MORADIA', 'expense', '🏠', '#45B7D1'),
      (p_user_id, 'SAÚDE', 'expense', '🏥', '#96CEB4'),
      (p_user_id, 'EDUCAÇÃO', 'expense', '📚', '#FFEAA7'),
      (p_user_id, 'LAZER', 'expense', '🎮', '#DDA0DD'),
      (p_user_id, 'VESTUÁRIO', 'expense', '👕', '#F8BBD9'),
      (p_user_id, 'SERVIÇOS', 'expense', '🔧', '#FFB347'),
      (p_user_id, 'IMPOSTOS', 'expense', '💰', '#FF6347'),
      (p_user_id, 'SUPERMERCADO', 'expense', '🛒', '#FF8C00'),
      (p_user_id, 'ÁGUA', 'expense', '💧', '#00BFFF'),
      (p_user_id, 'ENERGIA', 'expense', '⚡', '#FFD700'),
      (p_user_id, 'GÁS', 'expense', '🔥', '#FF4500'),
      (p_user_id, 'INTERNET', 'expense', '🌐', '#9370DB'),
      (p_user_id, 'CELULAR', 'expense', '📱', '#20B2AA'),
      (p_user_id, 'ASSINATURAS', 'expense', '📺', '#FF69B4'),
      (p_user_id, 'BELEZA', 'expense', '💄', '#FF1493'),
      (p_user_id, 'VIAGENS', 'expense', '✈️', '#4169E1'),
      (p_user_id, 'SEGUROS', 'expense', '🛡️', '#32CD32'),
      (p_user_id, 'JUROS', 'expense', '📊', '#DC143C'),
      (p_user_id, 'OUTROS', 'expense', '📌', '#808080'),
      -- Income
      (p_user_id, 'SALÁRIO', 'income', '💼', '#20B2AA'),
      (p_user_id, 'FREELANCE', 'income', '💻', '#9370DB'),
      (p_user_id, 'INVESTIMENTOS', 'income', '📊', '#00CED1'),
      (p_user_id, 'REEMBOLSOS', 'income', '💸', '#32CD32');
  END IF;

  -- Create default account if not exists
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = p_user_id) THEN
    INSERT INTO public.accounts (user_id, name, type, current_balance, currency)
    VALUES (p_user_id, 'Conta Principal', 'checking', 0, 'BRL');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION setup_new_user(UUID) TO authenticated;

