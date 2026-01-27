-- Migration: Add Encrypted Fields to Accounts and Pluggy Accounts
-- Description: Add encrypted columns for sensitive account data

-- Add encrypted columns to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS name_hash TEXT, -- For searching
  ADD COLUMN IF NOT EXISTS institution_encrypted TEXT;

-- Create indexes on hash columns for search
CREATE INDEX IF NOT EXISTS idx_accounts_name_hash ON public.accounts(name_hash);

-- Add encrypted columns to pluggy_accounts table
ALTER TABLE public.pluggy_accounts
  ADD COLUMN IF NOT EXISTS number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS number_hash TEXT, -- For searching
  ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS name_hash TEXT;

-- Create indexes on hash columns for search
CREATE INDEX IF NOT EXISTS idx_pluggy_accounts_number_hash ON public.pluggy_accounts(number_hash);
CREATE INDEX IF NOT EXISTS idx_pluggy_accounts_name_hash ON public.pluggy_accounts(name_hash);

-- Function to migrate existing accounts data
CREATE OR REPLACE FUNCTION migrate_accounts_to_encrypted()
RETURNS void AS $$
DECLARE
  account_record RECORD;
BEGIN
  -- Migrate accounts table
  FOR account_record IN SELECT id, name, institution FROM public.accounts
  LOOP
    UPDATE public.accounts
    SET
      name_encrypted = encrypt_sensitive_data(account_record.name),
      name_hash = hash_for_search(account_record.name),
      institution_encrypted = encrypt_sensitive_data(account_record.institution)
    WHERE id = account_record.id;
  END LOOP;
  
  -- Migrate pluggy_accounts table
  FOR account_record IN SELECT id, number, name FROM public.pluggy_accounts
  LOOP
    UPDATE public.pluggy_accounts
    SET
      number_encrypted = encrypt_sensitive_data(account_record.number),
      number_hash = hash_for_search(account_record.number),
      name_encrypted = encrypt_sensitive_data(account_record.name),
      name_hash = hash_for_search(account_record.name)
    WHERE id = account_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create view for decrypted accounts
CREATE OR REPLACE VIEW public.accounts_decrypted AS
SELECT
  id,
  user_id,
  decrypt_sensitive_data(name_encrypted) AS name,
  name_hash,
  type,
  current_balance,
  currency,
  decrypt_sensitive_data(institution_encrypted) AS institution,
  created_at,
  updated_at
FROM public.accounts;

-- Create view for decrypted pluggy_accounts
CREATE OR REPLACE VIEW public.pluggy_accounts_decrypted AS
SELECT
  id,
  user_id,
  pluggy_account_id,
  item_id,
  decrypt_sensitive_data(name_encrypted) AS name,
  name_hash,
  type,
  subtype,
  balance_cents,
  currency,
  decrypt_sensitive_data(number_encrypted) AS number,
  number_hash,
  created_at
FROM public.pluggy_accounts;

-- Grant access to views
GRANT SELECT ON public.accounts_decrypted TO authenticated;
GRANT SELECT ON public.pluggy_accounts_decrypted TO authenticated;

-- Update trigger function for accounts
CREATE OR REPLACE FUNCTION encrypt_accounts_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    NEW.name_encrypted := encrypt_sensitive_data(NEW.name);
    NEW.name_hash := hash_for_search(NEW.name);
  END IF;
  
  IF NEW.institution IS NOT NULL AND NEW.institution != '' THEN
    NEW.institution_encrypted := encrypt_sensitive_data(NEW.institution);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function for pluggy_accounts
CREATE OR REPLACE FUNCTION encrypt_pluggy_accounts_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.number IS NOT NULL AND NEW.number != '' THEN
    NEW.number_encrypted := encrypt_sensitive_data(NEW.number);
    NEW.number_hash := hash_for_search(NEW.number);
  END IF;
  
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    NEW.name_encrypted := encrypt_sensitive_data(NEW.name);
    NEW.name_hash := hash_for_search(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS encrypt_accounts_trigger ON public.accounts;
CREATE TRIGGER encrypt_accounts_trigger
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_accounts_trigger();

DROP TRIGGER IF EXISTS encrypt_pluggy_accounts_trigger ON public.pluggy_accounts;
CREATE TRIGGER encrypt_pluggy_accounts_trigger
  BEFORE INSERT OR UPDATE ON public.pluggy_accounts
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_pluggy_accounts_trigger();

-- Also encrypt pluggy_transactions description
ALTER TABLE public.pluggy_transactions
  ADD COLUMN IF NOT EXISTS description_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS description_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_description_hash ON public.pluggy_transactions(description_hash);

CREATE OR REPLACE FUNCTION encrypt_pluggy_transactions_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.description IS NOT NULL AND NEW.description != '' THEN
    NEW.description_encrypted := encrypt_sensitive_data(NEW.description);
    NEW.description_hash := hash_for_search(NEW.description);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_pluggy_transactions_trigger ON public.pluggy_transactions;
CREATE TRIGGER encrypt_pluggy_transactions_trigger
  BEFORE INSERT OR UPDATE ON public.pluggy_transactions
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_pluggy_transactions_trigger();

-- Comments
COMMENT ON COLUMN public.accounts.name_encrypted IS 'Encrypted account name (use name_hash for searching)';
COMMENT ON COLUMN public.accounts.name_hash IS 'Hash of account name for search without decrypting';
COMMENT ON COLUMN public.accounts.institution_encrypted IS 'Encrypted institution name';
COMMENT ON COLUMN public.pluggy_accounts.number_encrypted IS 'Encrypted account number (use number_hash for searching)';
COMMENT ON COLUMN public.pluggy_accounts.number_hash IS 'Hash of account number for search without decrypting';
COMMENT ON COLUMN public.pluggy_transactions.description_encrypted IS 'Encrypted transaction description';

-- Note: After migration is complete and verified, you can drop the original columns




