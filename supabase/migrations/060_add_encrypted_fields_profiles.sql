-- Migration: Add Encrypted Fields to Profiles
-- Description: Add encrypted columns for sensitive profile data and migrate existing data

-- Add encrypted columns (we'll keep original columns for migration, then drop them)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS email_hash TEXT, -- For searching without decrypting
  ADD COLUMN IF NOT EXISTS full_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS birth_date_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS cep_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS monthly_income_cents_encrypted TEXT; -- Encrypted as text

-- Create indexes on hash columns for search
CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON public.profiles(email_hash);

-- Function to migrate existing data to encrypted columns
CREATE OR REPLACE FUNCTION migrate_profiles_to_encrypted()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
BEGIN
  -- Migrate existing data
  FOR profile_record IN SELECT id, email, full_name, birth_date, cep, monthly_income_cents FROM public.profiles
  LOOP
    UPDATE public.profiles
    SET
      email_encrypted = encrypt_sensitive_data(profile_record.email),
      email_hash = hash_email_partial(profile_record.email),
      full_name_encrypted = encrypt_sensitive_data(profile_record.full_name),
      birth_date_encrypted = encrypt_sensitive_data(profile_record.birth_date::TEXT),
      cep_encrypted = encrypt_sensitive_data(profile_record.cep),
      monthly_income_cents_encrypted = encrypt_sensitive_data(
        CASE WHEN profile_record.monthly_income_cents IS NOT NULL 
        THEN profile_record.monthly_income_cents::TEXT 
        ELSE NULL END
      )
    WHERE id = profile_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run migration (comment out if you want to run manually)
-- SELECT migrate_profiles_to_encrypted();

-- Create view for decrypted profiles (for application use)
CREATE OR REPLACE VIEW public.profiles_decrypted AS
SELECT
  id,
  decrypt_sensitive_data(email_encrypted) AS email,
  email_hash,
  decrypt_sensitive_data(full_name_encrypted) AS full_name,
  decrypt_sensitive_data(birth_date_encrypted)::DATE AS birth_date,
  gender,
  decrypt_sensitive_data(cep_encrypted) AS cep,
  city,
  state,
  decrypt_sensitive_data(monthly_income_cents_encrypted)::BIGINT AS monthly_income_cents,
  avatar_url,
  role,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to view
GRANT SELECT ON public.profiles_decrypted TO authenticated;

-- Update trigger function to encrypt on insert/update
CREATE OR REPLACE FUNCTION encrypt_profiles_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Encrypt sensitive fields on INSERT or UPDATE
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email_encrypted := encrypt_sensitive_data(NEW.email);
    NEW.email_hash := hash_email_partial(NEW.email);
  END IF;
  
  IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    NEW.full_name_encrypted := encrypt_sensitive_data(NEW.full_name);
  END IF;
  
  IF NEW.birth_date IS NOT NULL THEN
    NEW.birth_date_encrypted := encrypt_sensitive_data(NEW.birth_date::TEXT);
  END IF;
  
  IF NEW.cep IS NOT NULL AND NEW.cep != '' THEN
    NEW.cep_encrypted := encrypt_sensitive_data(NEW.cep);
  END IF;
  
  IF NEW.monthly_income_cents IS NOT NULL THEN
    NEW.monthly_income_cents_encrypted := encrypt_sensitive_data(NEW.monthly_income_cents::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (will encrypt when using original columns)
DROP TRIGGER IF EXISTS encrypt_profiles_trigger ON public.profiles;
CREATE TRIGGER encrypt_profiles_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_profiles_trigger();

-- Comments
COMMENT ON COLUMN public.profiles.email_encrypted IS 'Encrypted email address (use email_hash for searching)';
COMMENT ON COLUMN public.profiles.email_hash IS 'Hash of email for search without decrypting';
COMMENT ON COLUMN public.profiles.full_name_encrypted IS 'Encrypted full name';
COMMENT ON COLUMN public.profiles.birth_date_encrypted IS 'Encrypted birth date';
COMMENT ON COLUMN public.profiles.cep_encrypted IS 'Encrypted CEP (postal code)';
COMMENT ON COLUMN public.profiles.monthly_income_cents_encrypted IS 'Encrypted monthly income in cents';
COMMENT ON VIEW public.profiles_decrypted IS 'View with decrypted profile data for application use';

-- Note: After migration is complete and verified, you can drop the original columns:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS full_name;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS birth_date;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS cep;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS monthly_income_cents;
-- But keep email for now as it's used in unique constraint and auth





