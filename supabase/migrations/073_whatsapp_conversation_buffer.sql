-- Migration: WhatsApp Conversation Buffer
-- Sistema de buffer para conversas pendentes do WhatsApp

-- Tabela para armazenar contexto de conversas pendentes
CREATE TABLE IF NOT EXISTS whatsapp_conversation_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,

  -- Estado da conversa
  pending_intent TEXT, -- 'create_transaction', 'delete_transaction', etc
  pending_data JSONB DEFAULT '{}', -- dados parciais coletados
  clarification_field TEXT, -- campo sendo solicitado: 'amount', 'category', etc

  -- Historico recente (ultimas 5 mensagens)
  conversation_history JSONB DEFAULT '[]',

  -- Controle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),

  -- Apenas um buffer por numero de telefone
  UNIQUE(phone_number)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_phone ON whatsapp_conversation_buffer(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_expires ON whatsapp_conversation_buffer(expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_user ON whatsapp_conversation_buffer(user_id);

-- RLS
ALTER TABLE whatsapp_conversation_buffer ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver apenas seu proprio buffer
CREATE POLICY "users_view_own_buffer" ON whatsapp_conversation_buffer
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Apenas service role pode inserir/atualizar/deletar (via API n8n)
CREATE POLICY "service_role_manage_buffer" ON whatsapp_conversation_buffer
  FOR ALL USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Funcao para limpar buffers expirados (pode ser chamada por cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_whatsapp_buffers()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM whatsapp_conversation_buffer
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_buffer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Renovar expiracao a cada atualizacao
  NEW.expires_at = now() + interval '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_buffer_updated_at
  BEFORE UPDATE ON whatsapp_conversation_buffer
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_buffer_updated_at();

COMMENT ON TABLE whatsapp_conversation_buffer IS 'Buffer de conversas pendentes do WhatsApp para coleta progressiva de informacoes';
COMMENT ON COLUMN whatsapp_conversation_buffer.pending_intent IS 'Intent da acao pendente: create_transaction, delete_transaction, etc';
COMMENT ON COLUMN whatsapp_conversation_buffer.pending_data IS 'Dados parciais coletados ate o momento (JSON)';
COMMENT ON COLUMN whatsapp_conversation_buffer.clarification_field IS 'Campo sendo solicitado ao usuario: amount, category, account, etc';
COMMENT ON COLUMN whatsapp_conversation_buffer.conversation_history IS 'Ultimas 5 mensagens da conversa (JSON array)';
