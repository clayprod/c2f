-- Fix encryption functions to use extensions schema prefix
-- The pgcrypto extension is installed in the 'extensions' schema

CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key BYTEA;
  iv BYTEA;
  encrypted_data BYTEA;
BEGIN
  IF data IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := decode(get_encryption_key(), 'hex');
  iv := extensions.gen_random_bytes(16);

  encrypted_data := extensions.encrypt_iv(
    convert_to(data, 'UTF8'),
    encryption_key,
    iv,
    'aes-cbc'
  );

  RETURN encode(iv || encrypted_data, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key BYTEA;
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

  iv := substring(data_with_iv FROM 1 FOR 16);
  encrypted_bytes := substring(data_with_iv FROM 17);

  decrypted_bytes := extensions.decrypt_iv(
    encrypted_bytes,
    encryption_key,
    iv,
    'aes-cbc'
  );

  RETURN convert_from(decrypted_bytes, 'UTF8');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
