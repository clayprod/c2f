-- Migration: Fix Audit Trigger for Profiles Table
-- Description: Fix audit_trigger_function() to handle tables that use 'id' instead of 'user_id' (like profiles)
-- The profiles table uses 'id' as the user identifier (referencing auth.users(id)), not 'user_id'
-- Also adds exception handling so audit failures don't break critical operations like user signup

-- Recreate the audit trigger function with proper handling for different table structures
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  audit_user_id UUID;
BEGIN
  -- Convert OLD and NEW to JSONB for safe data extraction (avoids column not found errors)
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    
    -- Determine user_id based on table structure:
    -- 1. Try user_id field (most tables)
    -- 2. For 'profiles' table, use 'id' (which is the user_id)
    -- 3. Fallback to auth.uid()
    audit_user_id := COALESCE(
      (old_data->>'user_id')::UUID,
      CASE WHEN TG_TABLE_NAME = 'profiles' THEN (old_data->>'id')::UUID ELSE NULL END,
      auth.uid()
    );
    
    BEGIN
      PERFORM public.create_audit_log(
        audit_user_id,
        'DELETE',
        TG_TABLE_NAME,
        (old_data->>'id')::UUID,
        old_data,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('trigger', true)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the operation - audit should never break business operations
      RAISE NOTICE 'Audit log failed for % DELETE: %', TG_TABLE_NAME, SQLERRM;
    END;
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    
    -- Determine user_id based on table structure
    audit_user_id := COALESCE(
      (new_data->>'user_id')::UUID,
      CASE WHEN TG_TABLE_NAME = 'profiles' THEN (new_data->>'id')::UUID ELSE NULL END,
      auth.uid()
    );
    
    BEGIN
      PERFORM public.create_audit_log(
        audit_user_id,
        'UPDATE',
        TG_TABLE_NAME,
        (new_data->>'id')::UUID,
        old_data,
        new_data,
        NULL,
        NULL,
        jsonb_build_object('trigger', true)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the operation
      RAISE NOTICE 'Audit log failed for % UPDATE: %', TG_TABLE_NAME, SQLERRM;
    END;
    RETURN NEW;
    
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    
    -- Determine user_id based on table structure
    audit_user_id := COALESCE(
      (new_data->>'user_id')::UUID,
      CASE WHEN TG_TABLE_NAME = 'profiles' THEN (new_data->>'id')::UUID ELSE NULL END,
      auth.uid()
    );
    
    BEGIN
      PERFORM public.create_audit_log(
        audit_user_id,
        'CREATE',
        TG_TABLE_NAME,
        (new_data->>'id')::UUID,
        NULL,
        new_data,
        NULL,
        NULL,
        jsonb_build_object('trigger', true)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the operation - critical for user signup to succeed
      RAISE NOTICE 'Audit log failed for % INSERT: %', TG_TABLE_NAME, SQLERRM;
    END;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.audit_trigger_function() IS 
  'Trigger function for automatic audit logging. Handles tables with user_id column and profiles table which uses id as user identifier. Uses JSONB extraction to avoid column not found errors and exception handling to prevent audit failures from breaking business operations.';
