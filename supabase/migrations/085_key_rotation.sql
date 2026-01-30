-- Migration: Key Rotation Support
-- Description: Add support for encryption key versioning and rotation

-- Create encryption_keys table for key versioning
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_version INTEGER NOT NULL UNIQUE,
  key_hash TEXT NOT NULL, -- SHA-256 hash of the key (for verification, not the key itself)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  retired_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Create index for active key lookup
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON public.encryption_keys(is_active, key_version DESC);

-- Insert initial key version (version 1)
-- Note: The actual key is stored in environment variable, not in the database
INSERT INTO public.encryption_keys (key_version, key_hash, is_active)
VALUES (1, 'initial', true)
ON CONFLICT (key_version) DO NOTHING;

-- Function to get current encryption key version
CREATE OR REPLACE FUNCTION get_current_key_version()
RETURNS INTEGER AS $$
DECLARE
  current_version INTEGER;
BEGIN
  SELECT key_version INTO current_version
  FROM public.encryption_keys
  WHERE is_active = true
  ORDER BY key_version DESC
  LIMIT 1;
  
  RETURN COALESCE(current_version, 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to rotate encryption key
-- This function should be called with a new encryption key in the environment
-- It will re-encrypt all data with the new key
CREATE OR REPLACE FUNCTION rotate_encryption_key()
RETURNS TABLE(
  table_name TEXT,
  rows_updated BIGINT,
  status TEXT
) AS $$
DECLARE
  new_version INTEGER;
  old_version INTEGER;
  table_record RECORD;
  rows_count BIGINT;
BEGIN
  -- Get current version
  SELECT get_current_key_version() INTO old_version;
  
  -- Create new version
  SELECT COALESCE(MAX(key_version), 0) + 1 INTO new_version
  FROM public.encryption_keys;
  
  -- Mark old key as retired
  UPDATE public.encryption_keys
  SET is_active = false, retired_at = NOW()
  WHERE key_version = old_version;
  
  -- Insert new key version
  INSERT INTO public.encryption_keys (key_version, key_hash, is_active)
  VALUES (new_version, 'version_' || new_version, true);
  
  -- Note: Actual re-encryption of data must be done by application code
  -- This function only manages key versioning
  
  -- Return status
  RETURN QUERY SELECT 
    'key_rotation'::TEXT,
    0::BIGINT,
    format('Key rotated from version %s to %s. Run application re-encryption script.', old_version, new_version)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt with specific key version (for migration)
-- Note: This is a placeholder - actual implementation depends on key storage strategy
CREATE OR REPLACE FUNCTION decrypt_with_version(encrypted_data TEXT, key_version INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
BEGIN
  -- Use current decryption function
  -- In a real implementation, you would select the appropriate key based on version
  RETURN decrypt_sensitive_data(encrypted_data);
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.encryption_keys IS 'Tracks encryption key versions for rotation support';
COMMENT ON COLUMN public.encryption_keys.key_version IS 'Version number of the encryption key';
COMMENT ON COLUMN public.encryption_keys.key_hash IS 'Hash of the key (for verification, not the actual key)';
COMMENT ON FUNCTION get_current_key_version() IS 'Returns the current active encryption key version';
COMMENT ON FUNCTION rotate_encryption_key() IS 'Rotates encryption key and marks old version as retired';






