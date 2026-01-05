-- Migration: Set initial admin user
-- Description: Set clayton@tenryu.com as admin

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'clayton@tenryu.com'
  AND (role IS NULL OR role != 'admin');

-- Verify update (this will show in logs)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE 'Admin role set for clayton@tenryu.com';
  ELSE
    RAISE NOTICE 'No user found with email clayton@tenryu.com or already admin';
  END IF;
END $$;

