-- Migration: Encryption Setup
-- Description: Enable pgcrypto extension and create encryption/decryption functions for sensitive data

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to get encryption key from environment variable
-- Note: This will be set via Supabase secrets or environment variable
-- The key should be 32 bytes (64 hex characters) for AES-256
CREATE OR REPLACE FUNCTION get_encryption_key()
RETURNS TEXT AS $$
BEGIN
  -- Try to get from environment variable first
  -- If not available, use a default (should be overridden in production)
  RETURN COALESCE(
    current_setting('app.encryption_key', true),
    '0000000000000000000000000000000000000000000000000000000000000000' -- 64 hex chars = 32 bytes
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to encrypt text data using AES-256-GCM
-- Returns base64 encoded ciphertext with IV prepended
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
  iv BYTEA;
  encrypted_data BYTEA;
BEGIN
  IF data IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := decode(get_encryption_key(), 'hex');
  iv := gen_random_bytes(12); -- 12 bytes for GCM IV
  
  encrypted_data := encrypt_iv(
    convert_to(data, 'UTF8'),
    encryption_key,
    iv,
    'aes-gcm'
  );
  
  -- Return base64 encoded: IV (12 bytes) + encrypted data
  RETURN encode(iv || encrypted_data, 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt text data using AES-256-GCM
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
  data_with_iv BYTEA;
  iv BYTEA;
  encrypted_bytes BYTEA;
  decrypted_bytes BYTEA;
BEGIN
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := decode(get_encryption_key(), 'hex');
  data_with_iv := decode(encrypted_data, 'base64');
  
  -- Extract IV (first 12 bytes) and encrypted data
  iv := substring(data_with_iv FROM 1 FOR 12);
  encrypted_bytes := substring(data_with_iv FROM 13);
  
  decrypted_bytes := decrypt_iv(
    encrypted_bytes,
    encryption_key,
    iv,
    'aes-gcm'
  );
  
  RETURN convert_from(decrypted_bytes, 'UTF8');
END;
$$ LANGUAGE plpgsql;

-- Function to create hash for searchable fields (SHA-256)
-- This allows searching without decrypting
CREATE OR REPLACE FUNCTION hash_for_search(data TEXT)
RETURNS TEXT AS $$
BEGIN
  IF data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return hex encoded SHA-256 hash
  RETURN encode(digest(data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create partial hash for email search (first 3 chars + domain)
-- This allows partial matching while maintaining privacy
CREATE OR REPLACE FUNCTION hash_email_partial(email TEXT)
RETURNS TEXT AS $$
DECLARE
  email_parts TEXT[];
  local_part TEXT;
  domain_part TEXT;
BEGIN
  IF email IS NULL OR email = '' THEN
    RETURN NULL;
  END IF;
  
  email_parts := string_to_array(email, '@');
  IF array_length(email_parts, 1) != 2 THEN
    RETURN hash_for_search(email);
  END IF;
  
  local_part := email_parts[1];
  domain_part := email_parts[2];
  
  -- Hash: first 3 chars of local part + full domain
  RETURN hash_for_search(
    substring(lower(local_part) FROM 1 FOR LEAST(3, length(local_part))) || '@' || lower(domain_part)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments for documentation
COMMENT ON FUNCTION get_encryption_key() IS 'Retrieves encryption key from environment variable or default';
COMMENT ON FUNCTION encrypt_sensitive_data(TEXT) IS 'Encrypts text data using AES-256-GCM. Returns base64 encoded IV+ciphertext';
COMMENT ON FUNCTION decrypt_sensitive_data(TEXT) IS 'Decrypts text data encrypted with encrypt_sensitive_data';
COMMENT ON FUNCTION hash_for_search(TEXT) IS 'Creates SHA-256 hash for searchable fields without exposing plaintext';
COMMENT ON FUNCTION hash_email_partial(TEXT) IS 'Creates partial hash for email search (first 3 chars + domain)';

