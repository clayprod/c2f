-- Migration: Create whatsapp_messages_log table
-- Logs WhatsApp messages for auditing (does not store sensitive content)

-- Create table for message logs
CREATE TABLE IF NOT EXISTS public.whatsapp_messages_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'document', 'verification')),
  content_summary TEXT, -- Summary only (no sensitive content)
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL, -- If a transaction was created
  action_type TEXT CHECK (action_type IN ('create', 'update', 'delete', 'query', 'clarify', 'verification')),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON public.whatsapp_messages_log(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages_log(status);

-- Enable RLS
ALTER TABLE public.whatsapp_messages_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their own logs
CREATE POLICY "Users can view own message logs" ON public.whatsapp_messages_log
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all logs
CREATE POLICY "Admins can view all message logs" ON public.whatsapp_messages_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- INSERT is only allowed via service role (n8n) - no policy for regular users
-- This ensures only the backend can create log entries
