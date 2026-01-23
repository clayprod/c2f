-- Migration: Add Balance Divergence and Daily Spending Notifications
-- Description: Add new notification rule types for balance divergence and daily spending alerts

-- Find and drop the existing CHECK constraint (PostgreSQL auto-generates names)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.notification_rules'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%rule_type%IN%';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.notification_rules DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Add new CHECK constraint with updated rule types
ALTER TABLE public.notification_rules
  ADD CONSTRAINT notification_rules_rule_type_check 
  CHECK (rule_type IN (
    'debt_due', 
    'receivable_due', 
    'budget_limit', 
    'budget_empty',
    'balance_divergence',
    'daily_spending_exceeded'
  ));

-- Insert default global rules for new notification types
INSERT INTO public.notification_rules (user_id, rule_type, enabled, frequency_hours)
VALUES 
  (NULL, 'balance_divergence', TRUE, 24),
  (NULL, 'daily_spending_exceeded', TRUE, 24)
ON CONFLICT (user_id, rule_type) DO NOTHING;

-- Comments
COMMENT ON COLUMN public.notification_rules.rule_type IS 'Rule types: debt_due, receivable_due, budget_limit, budget_empty, balance_divergence, daily_spending_exceeded';

