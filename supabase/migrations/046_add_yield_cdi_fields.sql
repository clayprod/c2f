-- Migration: Add CDI percentage yield option to accounts
-- Allows users to choose between fixed monthly rate or CDI percentage

-- Add yield type field (fixed = taxa fixa mensal, cdi_percentage = % do CDI)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS yield_type TEXT DEFAULT 'fixed' CHECK (yield_type IN ('fixed', 'cdi_percentage'));

-- Add CDI percentage field (e.g., 100 = 100% do CDI, 120 = 120% do CDI)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS cdi_percentage NUMERIC(6,2) DEFAULT NULL CHECK (cdi_percentage IS NULL OR (cdi_percentage >= 0 AND cdi_percentage <= 500));

-- Update existing accounts with yield_rate_monthly > 0 to have yield_type = 'fixed'
UPDATE public.accounts
SET yield_type = 'fixed'
WHERE yield_rate_monthly > 0 AND yield_type IS NULL;

-- Create table for caching CDI rates from BACEN
CREATE TABLE IF NOT EXISTS public.cdi_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL UNIQUE,
  daily_rate NUMERIC(10,6) NOT NULL, -- Taxa diária do CDI (ex: 0.055131)
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'bacen'
);

-- Index for quick lookup by date
CREATE INDEX IF NOT EXISTS idx_cdi_rates_date ON public.cdi_rates(rate_date DESC);

-- RLS for cdi_rates (read-only for all authenticated users)
ALTER TABLE public.cdi_rates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read CDI rates
CREATE POLICY "Users can read CDI rates"
  ON public.cdi_rates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update CDI rates
CREATE POLICY "Service role can manage CDI rates"
  ON public.cdi_rates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.yield_type IS 'Type of yield calculation: fixed (manual monthly rate) or cdi_percentage (percentage of CDI rate)';
COMMENT ON COLUMN public.accounts.cdi_percentage IS 'Percentage of CDI rate (e.g., 100 = 100% CDI, 120 = 120% CDI). Only used when yield_type = cdi_percentage';
COMMENT ON TABLE public.cdi_rates IS 'Cache of daily CDI rates from BACEN API (https://api.bcb.gov.br/dados/serie/bcdata.sgs.12)';
