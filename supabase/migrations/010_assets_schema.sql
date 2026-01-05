-- Migration: Assets Schema
-- Description: Tables for assets management (real estate, vehicles, rights, equipment, jewelry, etc.)

-- 1. Assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('real_estate', 'vehicle', 'rights', 'equipment', 'jewelry', 'other')),
  description TEXT,
  purchase_date DATE NOT NULL,
  purchase_price_cents BIGINT NOT NULL,
  current_value_cents BIGINT,
  location TEXT,
  license_plate TEXT,
  registration_number TEXT,
  insurance_company TEXT,
  insurance_policy_number TEXT,
  insurance_expiry_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'disposed')),
  sale_date DATE,
  sale_price_cents BIGINT,
  depreciation_method TEXT DEFAULT 'none' CHECK (depreciation_method IN ('linear', 'declining_balance', 'none')),
  depreciation_rate NUMERIC DEFAULT 0,
  useful_life_years INTEGER,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Asset Valuations table
CREATE TABLE IF NOT EXISTS public.asset_valuations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  valuation_date DATE NOT NULL,
  value_cents BIGINT NOT NULL,
  valuation_type TEXT DEFAULT 'manual' CHECK (valuation_type IN ('manual', 'depreciation', 'market')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(user_id, type);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_asset_id ON public.asset_valuations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_user_id ON public.asset_valuations(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_date ON public.asset_valuations(asset_id, valuation_date);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_valuations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assets
DROP POLICY IF EXISTS "Users can view their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON public.assets;

CREATE POLICY "Users can view their own assets" ON public.assets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own assets" ON public.assets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own assets" ON public.assets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own assets" ON public.assets
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for asset_valuations
DROP POLICY IF EXISTS "Users can view their own asset valuations" ON public.asset_valuations;
DROP POLICY IF EXISTS "Users can insert their own asset valuations" ON public.asset_valuations;
DROP POLICY IF EXISTS "Users can update their own asset valuations" ON public.asset_valuations;
DROP POLICY IF EXISTS "Users can delete their own asset valuations" ON public.asset_valuations;

CREATE POLICY "Users can view their own asset valuations" ON public.asset_valuations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own asset valuations" ON public.asset_valuations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own asset valuations" ON public.asset_valuations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own asset valuations" ON public.asset_valuations
  FOR DELETE USING (user_id = auth.uid());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


