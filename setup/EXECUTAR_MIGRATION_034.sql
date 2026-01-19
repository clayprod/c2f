-- ============================================================================
-- MIGRATION 034: Adicionar campos de contato de suporte
-- ============================================================================
-- Execute este script no Supabase Dashboard > SQL Editor
-- ============================================================================

-- Adicionar campos de contato de suporte na tabela global_settings
ALTER TABLE public.global_settings 
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_whatsapp TEXT;

-- Comentários
COMMENT ON COLUMN public.global_settings.support_email IS 'Support email address displayed in help center';
COMMENT ON COLUMN public.global_settings.support_whatsapp IS 'Support WhatsApp number displayed in help center (format: +5511999999999)';

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
-- Após executar este script:
-- ✅ Campos support_email e support_whatsapp estarão disponíveis
-- ✅ Admin poderá configurar contatos na tela de configurações globais
-- ✅ Usuários verão os contatos na central de ajuda
-- ============================================================================
