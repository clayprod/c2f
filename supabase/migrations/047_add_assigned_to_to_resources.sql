-- Migration: Add assigned_to to resources
-- Description: Add assigned_to field to debts, investments, assets, goals, receivables, and credit cards (accounts with type = 'credit_card')

-- 1. Add assigned_to to debts table
ALTER TABLE public.debts
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debts_assigned_to ON public.debts(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.debts.assigned_to IS 'User responsible for this debt (for shared accounts)';

-- 2. Add assigned_to to investments table
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_investments_assigned_to ON public.investments(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.investments.assigned_to IS 'User responsible for this investment (for shared accounts)';

-- 3. Add assigned_to to assets table
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON public.assets(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.assets.assigned_to IS 'User responsible for this asset (for shared accounts)';

-- 4. Add assigned_to to goals table
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_assigned_to ON public.goals(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.goals.assigned_to IS 'User responsible for this goal (for shared accounts)';

-- 5. Add assigned_to to receivables table
ALTER TABLE public.receivables
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_assigned_to ON public.receivables(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.receivables.assigned_to IS 'User responsible for this receivable (for shared accounts)';

-- 6. Add assigned_to to accounts table (for credit cards only)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_assigned_to ON public.accounts(assigned_to) WHERE type = 'credit_card' AND assigned_to IS NOT NULL;

COMMENT ON COLUMN public.accounts.assigned_to IS 'User responsible for this account (for shared accounts, primarily used for credit cards)';
