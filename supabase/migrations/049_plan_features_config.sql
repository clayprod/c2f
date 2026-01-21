-- Migration: Plan Features Configuration
-- Description: Add fields to global_settings for configuring plan features and pricing display

-- Add plan features configuration fields (JSONB)
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS plan_features_free JSONB DEFAULT '{
    "transactions_limit": {"enabled": true, "text": "Até 100 transações/mês"},
    "csv_import": {"enabled": true, "text": "Importação CSV"},
    "ofx_import": {"enabled": false, "text": "Importação OFX"},
    "ai_advisor": {"enabled": false, "text": "AI Advisor"},
    "budgets": {"enabled": false, "text": "Orçamentos e Projeções"},
    "investments": {"enabled": false, "text": "Investimentos e Dívidas"},
    "goals": {"enabled": false, "text": "Patrimônio e Objetivos"},
    "pluggy_integration": {"enabled": false, "text": "Integração Bancária"},
    "reports": {"enabled": false, "text": "Relatórios Executivos"},
    "ai_categorization": {"enabled": false, "text": "Categorização inteligente via IA"},
    "predictive_analysis": {"enabled": false, "text": "Análise preditiva de gastos"},
    "priority_support": {"enabled": false, "text": "Suporte prioritário"}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_features_pro JSONB DEFAULT '{
    "transactions_unlimited": {"enabled": true, "text": "Transações ilimitadas"},
    "csv_import": {"enabled": true, "text": "Importação CSV"},
    "ofx_import": {"enabled": true, "text": "Importação OFX"},
    "ai_advisor": {"enabled": true, "text": "AI Advisor (10 consultas/mês)"},
    "budgets": {"enabled": true, "text": "Orçamentos e Projeções"},
    "investments": {"enabled": true, "text": "Investimentos e Dívidas"},
    "goals": {"enabled": true, "text": "Patrimônio e Objetivos"},
    "pluggy_integration": {"enabled": false, "text": "Integração Bancária"},
    "reports": {"enabled": true, "text": "Relatórios Executivos"},
    "ai_categorization": {"enabled": false, "text": "Categorização inteligente via IA"},
    "predictive_analysis": {"enabled": false, "text": "Análise preditiva de gastos"},
    "priority_support": {"enabled": false, "text": "Suporte por email"}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_features_premium JSONB DEFAULT '{
    "transactions_unlimited": {"enabled": true, "text": "Transações ilimitadas"},
    "csv_import": {"enabled": true, "text": "Importação CSV"},
    "ofx_import": {"enabled": true, "text": "Importação OFX"},
    "ai_advisor": {"enabled": true, "text": "AI Advisor (100 consultas/mês)"},
    "budgets": {"enabled": true, "text": "Orçamentos e Projeções"},
    "investments": {"enabled": true, "text": "Investimentos e Dívidas"},
    "goals": {"enabled": true, "text": "Patrimônio e Objetivos"},
    "pluggy_integration": {"enabled": true, "text": "Integração Bancária"},
    "reports": {"enabled": true, "text": "Relatórios Executivos"},
    "ai_categorization": {"enabled": true, "text": "Categorização inteligente via IA"},
    "predictive_analysis": {"enabled": true, "text": "Análise preditiva de gastos"},
    "priority_support": {"enabled": true, "text": "Suporte prioritário via WhatsApp"}
  }'::jsonb;

-- Add plan display configuration fields
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS plan_display_config JSONB DEFAULT '{
    "free": {
      "name": "Free",
      "description": "Comece a organizar suas finanças",
      "priceFormatted": "Grátis",
      "period": "para sempre",
      "cta": "Começar agora",
      "popular": false
    },
    "pro": {
      "name": "Pro",
      "description": "O poder da IA para suas finanças",
      "period": "/mês",
      "cta": "Assinar Pro",
      "popular": true
    },
    "premium": {
      "name": "Premium",
      "description": "Análise avançada e IA ilimitada",
      "period": "/mês",
      "cta": "Assinar Premium",
      "popular": false
    }
  }'::jsonb;

-- Comments
COMMENT ON COLUMN public.global_settings.plan_features_free IS 'Features configuration for Free plan (JSONB with feature_id -> {enabled: boolean, text: string})';
COMMENT ON COLUMN public.global_settings.plan_features_pro IS 'Features configuration for Pro plan (JSONB with feature_id -> {enabled: boolean, text: string})';
COMMENT ON COLUMN public.global_settings.plan_features_premium IS 'Features configuration for Premium plan (JSONB with feature_id -> {enabled: boolean, text: string})';
COMMENT ON COLUMN public.global_settings.plan_display_config IS 'Display configuration for plans (names, descriptions, CTAs, etc.)';
