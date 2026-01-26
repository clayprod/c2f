-- Migration: Add Encrypted Fields to Transactions
-- Description: Add encrypted columns for sensitive transaction data

-- Add encrypted columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS description_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS description_hash TEXT, -- For searching
  ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;

-- Create indexes on hash columns for search
CREATE INDEX IF NOT EXISTS idx_transactions_description_hash ON public.transactions(description_hash);

-- Function to migrate existing data to encrypted columns
CREATE OR REPLACE FUNCTION migrate_transactions_to_encrypted()
RETURNS void AS $$
DECLARE
  transaction_record RECORD;
BEGIN
  -- Migrate existing data
  FOR transaction_record IN SELECT id, description, notes FROM public.transactions
  LOOP
    UPDATE public.transactions
    SET
      description_encrypted = encrypt_sensitive_data(transaction_record.description),
      description_hash = hash_for_search(transaction_record.description),
      notes_encrypted = encrypt_sensitive_data(transaction_record.notes)
    WHERE id = transaction_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create view for decrypted transactions (for application use)
CREATE OR REPLACE VIEW public.transactions_decrypted AS
SELECT
  id,
  user_id,
  account_id,
  category_id,
  posted_at,
  decrypt_sensitive_data(description_encrypted) AS description,
  description_hash,
  amount,
  currency,
  decrypt_sensitive_data(notes_encrypted) AS notes,
  created_at,
  updated_at
FROM public.transactions;

-- Grant access to view
GRANT SELECT ON public.transactions_decrypted TO authenticated;

-- Update trigger function to encrypt on insert/update
CREATE OR REPLACE FUNCTION encrypt_transactions_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Encrypt sensitive fields on INSERT or UPDATE
  IF NEW.description IS NOT NULL AND NEW.description != '' THEN
    NEW.description_encrypted := encrypt_sensitive_data(NEW.description);
    NEW.description_hash := hash_for_search(NEW.description);
  END IF;
  
  IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
    NEW.notes_encrypted := encrypt_sensitive_data(NEW.notes);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (will encrypt when using original columns)
DROP TRIGGER IF EXISTS encrypt_transactions_trigger ON public.transactions;
CREATE TRIGGER encrypt_transactions_trigger
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_transactions_trigger();

-- Comments
COMMENT ON COLUMN public.transactions.description_encrypted IS 'Encrypted transaction description (use description_hash for searching)';
COMMENT ON COLUMN public.transactions.description_hash IS 'Hash of description for search without decrypting';
COMMENT ON COLUMN public.transactions.notes_encrypted IS 'Encrypted transaction notes';
COMMENT ON VIEW public.transactions_decrypted IS 'View with decrypted transaction data for application use';

-- Note: After migration is complete and verified, you can drop the original columns:
-- ALTER TABLE public.transactions DROP COLUMN IF EXISTS description;
-- ALTER TABLE public.transactions DROP COLUMN IF EXISTS notes;



