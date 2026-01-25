-- Migration: Fix audit trigger for global_settings
-- Description: The global_settings table doesn't have a user_id column, so the audit trigger fails

-- Option 1: Create a specific audit function for global_settings that uses auth.uid() directly
CREATE OR REPLACE FUNCTION public.audit_trigger_global_settings_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Convert OLD and NEW to JSONB
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    PERFORM public.create_audit_log(
      auth.uid(), -- Use auth.uid() directly since global_settings has no user_id
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      old_data,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('trigger', true, 'table', 'global_settings')
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    PERFORM public.create_audit_log(
      auth.uid(), -- Use auth.uid() directly since global_settings has no user_id
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      old_data,
      new_data,
      NULL,
      NULL,
      jsonb_build_object('trigger', true, 'table', 'global_settings')
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_data := to_jsonb(NEW);
    PERFORM public.create_audit_log(
      auth.uid(), -- Use auth.uid() directly since global_settings has no user_id
      'CREATE',
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      new_data,
      NULL,
      NULL,
      jsonb_build_object('trigger', true, 'table', 'global_settings')
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old trigger and create a new one with the specific function
DROP TRIGGER IF EXISTS audit_global_settings_trigger ON public.global_settings;
CREATE TRIGGER audit_global_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_global_settings_function();

COMMENT ON FUNCTION public.audit_trigger_global_settings_function IS 'Specific audit trigger function for global_settings table (no user_id column)';
