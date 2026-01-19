-- ============================================================================
-- MIGRATION CONSOLIDADA - Adicionar colunas de imagem e contribuições
-- ============================================================================
-- Execute este script no Supabase Dashboard > SQL Editor para habilitar:
-- 1. Upload e posicionamento de imagens em objetivos (goals)
-- 2. Contribuições automáticas em orçamentos
-- 3. Campos de frequência de contribuição em goals, debts, investments
-- ============================================================================

-- Verificar colunas existentes antes de executar
-- Se alguma coluna já existir, o comando ADD COLUMN IF NOT EXISTS não fará nada

-- ============================================================================
-- 1. GOALS: Adicionar colunas de imagem
-- ============================================================================
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_position TEXT DEFAULT 'center';

COMMENT ON COLUMN public.goals.image_url IS 'URL da imagem de capa do objetivo (opcional)';
COMMENT ON COLUMN public.goals.image_position IS 'Posição da imagem: "top left", "center", "50% 50%", etc.';

-- ============================================================================
-- 2. GOALS: Adicionar colunas de contribuição automática
-- ============================================================================
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS include_in_budget BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS monthly_contribution_cents BIGINT DEFAULT 0;

-- Migrar include_in_projection para include_in_budget se a coluna existir (compatibilidade)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'goals'
    AND column_name = 'include_in_projection'
  ) THEN
    UPDATE public.goals
    SET include_in_budget = COALESCE(include_in_projection, FALSE)
    WHERE include_in_budget IS NULL OR include_in_budget = FALSE;
  END IF;
END $$;

COMMENT ON COLUMN public.goals.include_in_budget IS 'Flag para incluir aportes do objetivo no orçamento automático';
COMMENT ON COLUMN public.goals.contribution_frequency IS 'Frequência dos aportes: daily, weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.goals.monthly_contribution_cents IS 'Valor mensal do aporte em centavos (calculado ou fixo)';

-- ============================================================================
-- 3. DEBTS: Adicionar colunas de contribuição automática e negociação
-- ============================================================================
ALTER TABLE public.debts
ADD COLUMN IF NOT EXISTS is_negotiated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS include_in_budget BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS monthly_payment_cents BIGINT DEFAULT 0;

-- Atualizar is_negotiated para dívidas com status 'negociada'
UPDATE public.debts
SET is_negotiated = TRUE
WHERE status = 'negociada' AND is_negotiated = FALSE;

COMMENT ON COLUMN public.debts.is_negotiated IS 'Flag indicando se a dívida foi negociada (usada para validações e orçamento)';
COMMENT ON COLUMN public.debts.include_in_budget IS 'Flag para incluir pagamentos da dívida no orçamento (apenas dívidas negociadas)';
COMMENT ON COLUMN public.debts.contribution_frequency IS 'Frequência dos pagamentos: daily, weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.debts.monthly_payment_cents IS 'Valor mensal do pagamento em centavos';

-- ============================================================================
-- 4. INVESTMENTS: Adicionar colunas de contribuição automática
-- ============================================================================
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS include_in_budget BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS monthly_contribution_cents BIGINT DEFAULT 0;

COMMENT ON COLUMN public.investments.include_in_budget IS 'Flag para incluir aportes do investimento no orçamento';
COMMENT ON COLUMN public.investments.contribution_frequency IS 'Frequência dos aportes: daily, weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.investments.monthly_contribution_cents IS 'Valor mensal do aporte em centavos';

-- ============================================================================
-- 5. TRANSACTIONS: Adicionar coluna de frequência de contribuição
-- ============================================================================
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS contribution_frequency TEXT CHECK (contribution_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));

COMMENT ON COLUMN public.transactions.contribution_frequency IS 'Frequência para transações recorrentes usadas em cálculos de orçamento (separado de recurrence_rule)';

-- ============================================================================
-- 6. BUDGETS: Adicionar colunas de validação de mínimo
-- ============================================================================
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS minimum_amount_planned NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_contributions_cents BIGINT DEFAULT 0;

COMMENT ON COLUMN public.budgets.minimum_amount_planned IS 'Valor mínimo permitido baseado em contribuições automáticas (em reais)';
COMMENT ON COLUMN public.budgets.auto_contributions_cents IS 'Soma de todas as contribuições automáticas em centavos';

-- Adicionar constraint para validar valor mínimo (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'budgets_minimum_check'
  ) THEN
    ALTER TABLE public.budgets
    ADD CONSTRAINT budgets_minimum_check
    CHECK (amount_planned >= minimum_amount_planned);
  END IF;
END $$;

-- ============================================================================
-- 7. INDEXES para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_goals_budget_inclusion
ON public.goals(user_id, include_in_budget, contribution_frequency)
WHERE include_in_budget = TRUE;

CREATE INDEX IF NOT EXISTS idx_debts_budget_inclusion
ON public.debts(user_id, include_in_budget, is_negotiated, contribution_frequency)
WHERE include_in_budget = TRUE AND is_negotiated = TRUE;

CREATE INDEX IF NOT EXISTS idx_investments_budget_inclusion
ON public.investments(user_id, include_in_budget, contribution_frequency)
WHERE include_in_budget = TRUE;

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_frequency
ON public.transactions(user_id, category_id, contribution_frequency)
WHERE recurrence_rule IS NOT NULL OR contribution_frequency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_minimum
ON public.budgets(user_id, category_id, minimum_amount_planned)
WHERE minimum_amount_planned > 0;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
-- Após executar este script:
-- ✅ Você poderá fazer upload de imagens para objetivos
-- ✅ Orçamentos automáticos com base em goals, debts e investments
-- ✅ Validação de valores mínimos em orçamentos
-- ============================================================================

