-- Migration: Performance indexes for admin queries
-- Description: Create indexes to optimize admin aggregation queries

-- Index for aggregating transactions by location (city/state)
CREATE INDEX IF NOT EXISTS idx_transactions_user_location ON public.transactions(user_id, posted_at) 
  WHERE amount < 0; -- Only expenses for spending analysis

-- Index for searching transaction descriptions (admin search filter)
CREATE INDEX IF NOT EXISTS idx_transactions_description_search ON public.transactions 
  USING gin(to_tsvector('portuguese', description));

-- Index for filtering profiles by birth_date (for age calculation)
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON public.profiles(birth_date) 
  WHERE birth_date IS NOT NULL;

-- Index for filtering profiles by gender
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender) 
  WHERE gender IS NOT NULL;

-- Index for filtering profiles by state/city
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(state, city) 
  WHERE state IS NOT NULL AND city IS NOT NULL;

-- Index for joining transactions with profiles for location-based aggregation
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at_desc ON public.transactions(posted_at DESC);

-- Index for category-based aggregation
CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON public.transactions(category_id, posted_at) 
  WHERE category_id IS NOT NULL;

-- Composite index for period-based queries with location
CREATE INDEX IF NOT EXISTS idx_transactions_period_location ON public.transactions(posted_at, amount);

