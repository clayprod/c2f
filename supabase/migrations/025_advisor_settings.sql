-- Migration: 024_advisor_settings.sql
-- Description: Add advisor configuration fields to global_settings and insight_type to advisor_insights

-- ============================================================================
-- PART 1: Add new columns to global_settings for AI Advisor configuration
-- ============================================================================

-- Tips prompt (separate from chat prompt)
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS tips_prompt TEXT;

-- Toggle to enable/disable tips feature
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT true;

-- Maximum tokens for chat history (to control costs)
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS chat_max_tokens INTEGER DEFAULT 4000;

-- Session TTL in minutes for Redis
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS session_ttl_minutes INTEGER DEFAULT 30;

-- ============================================================================
-- PART 2: Add insight_type to advisor_insights to differentiate chat vs tips
-- ============================================================================

-- Add insight_type column to distinguish between chat responses and daily tips
ALTER TABLE advisor_insights ADD COLUMN IF NOT EXISTS insight_type TEXT DEFAULT 'chat';

-- Add check constraint for valid insight types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'advisor_insights_type_check'
    ) THEN
        ALTER TABLE advisor_insights
        ADD CONSTRAINT advisor_insights_type_check
        CHECK (insight_type IN ('chat', 'daily_tip'));
    END IF;
END $$;

-- Create index for efficient querying of daily tips by user
CREATE INDEX IF NOT EXISTS idx_advisor_insights_type
ON advisor_insights(user_id, insight_type, created_at DESC);

-- ============================================================================
-- PART 3: Set default values for tips_prompt
-- ============================================================================

-- Update existing row with default tips prompt if tips_prompt is null
UPDATE global_settings
SET tips_prompt = 'Você é um consultor financeiro pessoal inteligente. Analise os dados financeiros do usuário e forneça uma dica do dia personalizada e acionável.

Diretrizes:
1. Foque em UMA dica principal clara e específica
2. Baseie-se nos dados reais do usuário (gastos, orçamentos, metas, dívidas)
3. Seja motivador mas realista
4. Sugira ações concretas que o usuário pode tomar hoje
5. Use linguagem amigável e acessível (português brasileiro)
6. Identifique padrões de gastos ou oportunidades de economia
7. Considere o contexto completo: renda, despesas, dívidas, metas

Formato da resposta (JSON obrigatório):
{
  "summary": "Resumo da dica em 1-2 frases",
  "insights": [
    {
      "type": "spending_pattern|budget_alert|goal_progress|debt_warning|saving_opportunity",
      "message": "Descrição do insight",
      "severity": "low|medium|high"
    }
  ],
  "actions": [
    {
      "type": "review_category|adjust_budget|create_goal|prioritize_debt|transfer_savings",
      "description": "Descrição da ação sugerida",
      "payload": {},
      "confidence": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high",
  "citations": []
}'
WHERE tips_prompt IS NULL;

-- ============================================================================
-- PART 4: Comments for documentation
-- ============================================================================

COMMENT ON COLUMN global_settings.tips_prompt IS 'System prompt for daily tips generation';
COMMENT ON COLUMN global_settings.tips_enabled IS 'Toggle to enable/disable daily tips feature';
COMMENT ON COLUMN global_settings.chat_max_tokens IS 'Maximum tokens allowed in chat history';
COMMENT ON COLUMN global_settings.session_ttl_minutes IS 'Session TTL in minutes for Redis cache';
COMMENT ON COLUMN advisor_insights.insight_type IS 'Type of insight: chat (conversation) or daily_tip (dashboard tips)';
