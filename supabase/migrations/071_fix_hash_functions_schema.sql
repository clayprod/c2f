-- Migration: Fix hash functions to use extensions schema prefix
-- Description: The pgcrypto extension is installed in the 'extensions' schema,
--   so we need to prefix digest() calls with 'extensions.'
--   Also adding SECURITY DEFINER and SET search_path for proper execution during signup

-- Fix hash_for_search to use extensions.digest()
CREATE OR REPLACE FUNCTION public.hash_for_search(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
BEGIN
  IF data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return hex encoded SHA-256 hash using extensions schema prefix
  RETURN encode(extensions.digest(data, 'sha256'), 'hex');
END;
$function$;

-- Fix hash_email_partial to also use SECURITY DEFINER for consistency
CREATE OR REPLACE FUNCTION public.hash_email_partial(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
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
    RETURN public.hash_for_search(email);
  END IF;
  
  local_part := email_parts[1];
  domain_part := email_parts[2];
  
  -- Hash: first 3 chars of local part + full domain
  RETURN public.hash_for_search(
    substring(lower(local_part) FROM 1 FOR LEAST(3, length(local_part))) || '@' || lower(domain_part)
  );
END;
$function$;

-- Add comments
COMMENT ON FUNCTION public.hash_for_search(TEXT) IS 'Creates SHA-256 hash for searchable fields. Uses extensions.digest() for pgcrypto compatibility.';
COMMENT ON FUNCTION public.hash_email_partial(TEXT) IS 'Creates partial hash for email search (first 3 chars + domain). Uses SECURITY DEFINER for signup compatibility.';
