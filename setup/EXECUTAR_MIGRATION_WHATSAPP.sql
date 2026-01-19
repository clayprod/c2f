-- ============================================
-- MIGRATION: WhatsApp Integration
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- PARTE 1: Adicionar campos em global_settings
-- ============================================

ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT,
ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
ADD COLUMN IF NOT EXISTS evolution_webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS n8n_api_key TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.global_settings.evolution_api_url IS 'Base URL of the Evolution API (e.g., https://evolution.example.com)';
COMMENT ON COLUMN public.global_settings.evolution_api_key IS 'Global API Key for Evolution API authentication';
COMMENT ON COLUMN public.global_settings.evolution_instance_name IS 'Name of the WhatsApp instance configured in Evolution API';
COMMENT ON COLUMN public.global_settings.evolution_webhook_secret IS 'Secret for validating webhooks from Evolution API';
COMMENT ON COLUMN public.global_settings.n8n_api_key IS 'API Key for n8n workflow authentication';
COMMENT ON COLUMN public.global_settings.whatsapp_enabled IS 'Enable/disable WhatsApp integration globally';

-- ============================================
-- PARTE 2: Criar tabela whatsapp_verifications
-- ============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL,
  phone_number_normalized TEXT NOT NULL,
  verification_code TEXT,
  verification_code_expires_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(phone_number_normalized)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_user_id ON public.whatsapp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_phone ON public.whatsapp_verifications(phone_number_normalized);
CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_status ON public.whatsapp_verifications(status);

ALTER TABLE public.whatsapp_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own verification" ON public.whatsapp_verifications;
DROP POLICY IF EXISTS "Users can insert own verification" ON public.whatsapp_verifications;
DROP POLICY IF EXISTS "Users can update own verification" ON public.whatsapp_verifications;
DROP POLICY IF EXISTS "Users can delete own verification" ON public.whatsapp_verifications;
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.whatsapp_verifications;

CREATE POLICY "Users can view own verification" ON public.whatsapp_verifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own verification" ON public.whatsapp_verifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own verification" ON public.whatsapp_verifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own verification" ON public.whatsapp_verifications
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all verifications" ON public.whatsapp_verifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_verifications_updated_at ON public.whatsapp_verifications;
CREATE TRIGGER update_whatsapp_verifications_updated_at
  BEFORE UPDATE ON public.whatsapp_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_verifications_updated_at();

-- ============================================
-- PARTE 3: Criar tabela whatsapp_messages_log
-- ============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_messages_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'document', 'verification')),
  content_summary TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  action_type TEXT CHECK (action_type IN ('create', 'update', 'delete', 'query', 'clarify', 'verification')),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON public.whatsapp_messages_log(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages_log(status);

ALTER TABLE public.whatsapp_messages_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own message logs" ON public.whatsapp_messages_log;
DROP POLICY IF EXISTS "Admins can view all message logs" ON public.whatsapp_messages_log;

CREATE POLICY "Users can view own message logs" ON public.whatsapp_messages_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all message logs" ON public.whatsapp_messages_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- VERIFICACAO
-- ============================================

SELECT 'Migration WhatsApp executada com sucesso!' as resultado;

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'global_settings'
  AND column_name IN ('evolution_api_url', 'evolution_api_key', 'evolution_instance_name', 'n8n_api_key', 'whatsapp_enabled');

-- Verificar se as tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('whatsapp_verifications', 'whatsapp_messages_log');
