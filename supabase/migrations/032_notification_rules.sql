-- Migration: Notification Rules Schema
-- Description: Create tables for notification rules and sent log

-- 1. Notification Rules table
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('debt_due', 'receivable_due', 'budget_limit', 'budget_empty')),
  enabled BOOLEAN DEFAULT TRUE,
  threshold_days INTEGER,
  threshold_percentage NUMERIC,
  frequency_hours INTEGER NOT NULL DEFAULT 24 CHECK (frequency_hours >= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_rule_type UNIQUE(user_id, rule_type)
);

-- 2. Notification Sent Log table
CREATE TABLE IF NOT EXISTS public.notification_sent_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rule_type TEXT NOT NULL,
  entity_id UUID,
  entity_type TEXT,
  last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_rule_entity UNIQUE(user_id, rule_type, entity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_rules_user_id ON public.notification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_type ON public.notification_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON public.notification_rules(user_id, enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_sent_log_user_id ON public.notification_sent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_sent_log_rule_type ON public.notification_sent_log(user_id, rule_type);
CREATE INDEX IF NOT EXISTS idx_notification_sent_log_last_sent ON public.notification_sent_log(user_id, rule_type, last_sent_at);

-- Enable RLS
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_sent_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_rules
DROP POLICY IF EXISTS "Users can view own notification rules" ON public.notification_rules;
DROP POLICY IF EXISTS "Users can insert own notification rules" ON public.notification_rules;
DROP POLICY IF EXISTS "Users can update own notification rules" ON public.notification_rules;
DROP POLICY IF EXISTS "Users can delete own notification rules" ON public.notification_rules;

CREATE POLICY "Users can view own notification rules" ON public.notification_rules
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own notification rules" ON public.notification_rules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification rules" ON public.notification_rules
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notification rules" ON public.notification_rules
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for notification_sent_log
DROP POLICY IF EXISTS "Users can view own notification sent log" ON public.notification_sent_log;
DROP POLICY IF EXISTS "Users can insert own notification sent log" ON public.notification_sent_log;
DROP POLICY IF EXISTS "Users can update own notification sent log" ON public.notification_sent_log;

CREATE POLICY "Users can view own notification sent log" ON public.notification_sent_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification sent log" ON public.notification_sent_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification sent log" ON public.notification_sent_log
  FOR UPDATE USING (user_id = auth.uid());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON public.notification_rules;
CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.notification_rules IS 'User notification rules configuration';
COMMENT ON COLUMN public.notification_rules.user_id IS 'NULL means global rule, otherwise user-specific rule';
COMMENT ON COLUMN public.notification_rules.threshold_days IS 'Days before due date to alert (for debt_due, receivable_due)';
COMMENT ON COLUMN public.notification_rules.threshold_percentage IS 'Percentage of limit to alert (for budget_limit, e.g., 80 = 80%)';
COMMENT ON COLUMN public.notification_rules.frequency_hours IS 'Hours between notifications of the same type';
COMMENT ON TABLE public.notification_sent_log IS 'Log of sent notifications to prevent spam';
COMMENT ON COLUMN public.notification_sent_log.entity_type IS 'Type of entity: debts, receivables, budgets';
