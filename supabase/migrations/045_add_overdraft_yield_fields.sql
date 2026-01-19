-- Migration: Add Overdraft and Yield Fields to Accounts
-- Description: Add fields for overdraft limit, overdraft interest rate, and account yield rate

-- 1. Add overdraft limit field (in cents)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS overdraft_limit_cents BIGINT DEFAULT 0;

-- 2. Add overdraft interest rate (monthly, as percentage)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS overdraft_interest_rate_monthly NUMERIC(6,3) DEFAULT 0;

-- 3. Add account yield rate (monthly, as percentage)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS yield_rate_monthly NUMERIC(6,3) DEFAULT 0;

-- 4. Add constraints for validation
DO $$
BEGIN
  -- Overdraft limit must be >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_overdraft_limit_check') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_overdraft_limit_check
      CHECK (overdraft_limit_cents >= 0);
  END IF;

  -- Interest rate must be >= 0 and <= 100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_overdraft_interest_rate_check') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_overdraft_interest_rate_check
      CHECK (overdraft_interest_rate_monthly >= 0 AND overdraft_interest_rate_monthly <= 100);
  END IF;

  -- Yield rate must be >= 0 and <= 100
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_yield_rate_check') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_yield_rate_check
      CHECK (yield_rate_monthly >= 0 AND yield_rate_monthly <= 100);
  END IF;
END $$;

-- 5. Add comments
COMMENT ON COLUMN public.accounts.overdraft_limit_cents IS 'Overdraft limit (cheque especial) in cents. If > 0, account can have negative balance up to this limit.';
COMMENT ON COLUMN public.accounts.overdraft_interest_rate_monthly IS 'Monthly interest rate (as percentage) applied to negative balance when overdraft is used. Example: 5.5 means 5.5% per month.';
COMMENT ON COLUMN public.accounts.yield_rate_monthly IS 'Monthly yield rate (as percentage) applied to positive balance. Example: 0.5 means 0.5% per month.';

-- 6. Create indexes for performance (queries filtering by these fields)
CREATE INDEX IF NOT EXISTS idx_accounts_overdraft_limit ON public.accounts(user_id, overdraft_limit_cents)
WHERE overdraft_limit_cents > 0;

CREATE INDEX IF NOT EXISTS idx_accounts_yield_rate ON public.accounts(user_id, yield_rate_monthly)
WHERE yield_rate_monthly > 0;

