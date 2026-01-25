-- Migration: Fix audit trigger for global_settings (robust version)
-- Description: Ensure the global_settings audit trigger uses the correct function that doesn't require user_id column

-- First, drop the potentially broken trigger
DROP TRIGGER IF EXISTS audit_global_settings_trigger ON public.global_settings;

-- Create or replace the specific audit function for global_settings
-- This function handles the case where there's no user_id column and auth.uid() might be NULL (service role)
CREATE OR REPLACE FUNCTION public.audit_trigger_global_settings_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  current_user_id UUID;
BEGIN
  -- Get current user - might be NULL when using service role
  current_user_id := auth.uid();
  
  -- Convert OLD and NEW to JSONB
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    -- Only create audit log if we can identify the user, or if we want to log anyway
    BEGIN
      PERFORM public.create_audit_log(
        current_user_id,
        'DELETE',
        TG_TABLE_NAME,
        OLD.id,
        old_data,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('trigger', true, 'table', 'global_settings', 'service_role', current_user_id IS NULL)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the operation
      RAISE NOTICE 'Audit log failed for global_settings DELETE: %', SQLERRM;
    END;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    BEGIN
      PERFORM public.create_audit_log(
        current_user_id,
        'UPDATE',
        TG_TABLE_NAME,
        NEW.id,
        old_data,
        new_data,
        NULL,
        NULL,
        jsonb_build_object('trigger', true, 'table', 'global_settings', 'service_role', current_user_id IS NULL)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the operation
      RAISE NOTICE 'Audit log failed for global_settings UPDATE: %', SQLERRM;
    END;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    BEGIN
      PERFORM public.create_audit_log(
        current_user_id,
        'CREATE',
        TG_TABLE_NAME,
        NEW.id,
        NULL,
        new_data,
        NULL,
        NULL,
        jsonb_build_object('trigger', true, 'table', 'global_settings', 'service_role', current_user_id IS NULL)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the operation
      RAISE NOTICE 'Audit log failed for global_settings INSERT: %', SQLERRM;
    END;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger with the correct function
CREATE TRIGGER audit_global_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_global_settings_function();

COMMENT ON FUNCTION public.audit_trigger_global_settings_function IS 'Robust audit trigger function for global_settings table - handles service role and missing user_id gracefully';
