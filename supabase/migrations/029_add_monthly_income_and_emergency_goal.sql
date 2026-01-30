-- Migration: Add Monthly Income and Emergency Goal
-- Description: Add monthly_income_cents field to profiles and create default emergency fund goal

-- 1. Add monthly_income_cents column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS monthly_income_cents BIGINT;

-- 2. Update setup_new_user function to create emergency fund goal
CREATE OR REPLACE FUNCTION setup_new_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_monthly_income_cents BIGINT;
  v_emergency_fund_target_cents BIGINT;
BEGIN
  -- Check if user already has categories
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id) THEN
    -- Insert default categories for the new user
    INSERT INTO public.categories (user_id, name, type, icon, color)
    VALUES
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

  -- Get monthly income from profile
  SELECT monthly_income_cents INTO v_monthly_income_cents
  FROM public.profiles
  WHERE id = p_user_id;

  -- Create or update emergency fund goal if monthly income is set
  IF v_monthly_income_cents IS NOT NULL AND v_monthly_income_cents > 0 THEN
    -- Calculate target: 6x monthly income
    v_emergency_fund_target_cents := v_monthly_income_cents * 6;

    -- Check if emergency fund goal already exists
    IF EXISTS (
      SELECT 1 FROM public.goals 
      WHERE user_id = p_user_id 
      AND name = 'Reserva de Emergência'
    ) THEN
      -- Update existing goal target amount
      UPDATE public.goals
      SET 
        target_amount_cents = v_emergency_fund_target_cents,
        description = 'Reserva de emergência recomendada equivalente a 6 meses de renda',
        updated_at = NOW()
      WHERE user_id = p_user_id 
      AND name = 'Reserva de Emergência';
    ELSE
      -- Insert new emergency fund goal
      INSERT INTO public.goals (
        user_id,
        name,
        description,
        target_amount_cents,
        current_amount_cents,
        status,
        priority,
        icon,
        color
      )
      VALUES (
        p_user_id,
        'Reserva de Emergência',
        'Reserva de emergência recomendada equivalente a 6 meses de renda',
        v_emergency_fund_target_cents,
        0,
        'active',
        'high',
        '🛡️',
        '#32CD32'
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION setup_new_user(UUID) TO authenticated;
