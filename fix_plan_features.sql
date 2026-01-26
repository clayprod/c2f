-- Migration: Update Plan Features to Match New Structure
-- Description: Update plan_features_* columns to match the new module-based structure

-- Update Free Plan features
UPDATE public.global_settings 
SET plan_features_free = '{
  "dashboard": {"enabled": true, "text": "Visão geral das finanças"},
  "transactions": {"enabled": true, "limit": 100, "text": "Até 100 lançamentos/mês"},
  "accounts": {"enabled": true, "text": "Contas bancárias ilimitadas"},
  "credit_cards": {"enabled": true, "text": "Controle de cartões de crédito"},
  "categories": {"enabled": true, "text": "Categorização personalizada"},
  "budgets": {"enabled": false, "text": "Orçamentos mensais por categoria"},
  "debts": {"enabled": false, "text": "Controle e negociação de dívidas"},
  "receivables": {"enabled": false, "text": "Gestão de recebíveis"},
  "investments": {"enabled": false, "text": "Acompanhamento de investimentos"},
  "assets": {"enabled": false, "text": "Gestão de patrimônio e bens"},
  "goals": {"enabled": false, "text": "Metas financeiras com projeções"},
  "reports": {"enabled": false, "text": "Relatórios detalhados e exportação"},
  "integrations": {"enabled": false, "text": "WhatsApp + Open Finance"},
  "ai_advisor": {"enabled": false, "text": "AI Advisor"}
}'::jsonb
WHERE plan_features_free IS NULL OR 
      plan_features_free::text NOT LIKE '%dashboard%' OR 
      plan_features_free::text NOT LIKE '%transactions%';

-- Update Pro Plan features
UPDATE public.global_settings 
SET plan_features_pro = '{
  "dashboard": {"enabled": true, "text": "Visão geral das finanças"},
  "transactions": {"enabled": true, "unlimited": true, "text": "Lançamentos ilimitados"},
  "accounts": {"enabled": true, "text": "Contas bancárias ilimitadas"},
  "credit_cards": {"enabled": true, "text": "Controle de cartões de crédito"},
  "categories": {"enabled": true, "text": "Categorização personalizada"},
  "budgets": {"enabled": true, "text": "Orçamentos mensais por categoria"},
  "debts": {"enabled": true, "text": "Controle e negociação de dívidas"},
  "receivables": {"enabled": true, "text": "Gestão de recebíveis"},
  "investments": {"enabled": true, "text": "Acompanhamento de investimentos"},
  "assets": {"enabled": false, "text": "Gestão de patrimônio e bens"},
  "goals": {"enabled": true, "text": "Metas financeiras com projeções"},
  "reports": {"enabled": false, "text": "Relatórios detalhados e exportação"},
  "integrations": {"enabled": false, "text": "WhatsApp + Open Finance"},
  "ai_advisor": {"enabled": true, "limit": 10, "text": "AI Advisor (10 consultas/mês)"}
}'::jsonb
WHERE plan_features_pro IS NULL OR 
      plan_features_pro::text NOT LIKE '%dashboard%' OR 
      plan_features_pro::text NOT LIKE '%transactions%';

-- Update Premium Plan features
UPDATE public.global_settings 
SET plan_features_premium = '{
  "dashboard": {"enabled": true, "text": "Visão geral das finanças"},
  "transactions": {"enabled": true, "unlimited": true, "text": "Lançamentos ilimitados"},
  "accounts": {"enabled": true, "text": "Contas bancárias ilimitadas"},
  "credit_cards": {"enabled": true, "text": "Controle de cartões de crédito"},
  "categories": {"enabled": true, "text": "Categorização personalizada"},
  "budgets": {"enabled": true, "text": "Orçamentos mensais por categoria"},
  "debts": {"enabled": true, "text": "Controle e negociação de dívidas"},
  "receivables": {"enabled": true, "text": "Gestão de recebíveis"},
  "investments": {"enabled": true, "text": "Acompanhamento de investimentos"},
  "assets": {"enabled": true, "text": "Gestão de patrimônio e bens"},
  "goals": {"enabled": true, "text": "Metas financeiras com projeções"},
  "reports": {"enabled": true, "text": "Relatórios detalhados e exportação"},
  "integrations": {"enabled": true, "text": "WhatsApp + Open Finance"},
  "ai_advisor": {"enabled": true, "unlimited": true, "text": "AI Advisor ilimitado"}
}'::jsonb
WHERE plan_features_premium IS NULL OR 
      plan_features_premium::text NOT LIKE '%dashboard%' OR 
      plan_features_premium::text NOT LIKE '%transactions%';

-- Insert default settings if no row exists
INSERT INTO public.global_settings (
  plan_features_free,
  plan_features_pro,
  plan_features_premium,
  plan_display_config
) VALUES (
  '{
    "dashboard": {"enabled": true, "text": "Visão geral das finanças"},
    "transactions": {"enabled": true, "limit": 100, "text": "Até 100 lançamentos/mês"},
    "accounts": {"enabled": true, "text": "Contas bancárias ilimitadas"},
    "credit_cards": {"enabled": true, "text": "Controle de cartões de crédito"},
    "categories": {"enabled": true, "text": "Categorização personalizada"},
    "budgets": {"enabled": false, "text": "Orçamentos mensais por categoria"},
    "debts": {"enabled": false, "text": "Controle e negociação de dívidas"},
    "receivables": {"enabled": false, "text": "Gestão de recebíveis"},
    "investments": {"enabled": false, "text": "Acompanhamento de investimentos"},
    "assets": {"enabled": false, "text": "Gestão de patrimônio e bens"},
    "goals": {"enabled": false, "text": "Metas financeiras com projeções"},
    "reports": {"enabled": false, "text": "Relatórios detalhados e exportação"},
    "integrations": {"enabled": false, "text": "WhatsApp + Open Finance"},
    "ai_advisor": {"enabled": false, "text": "AI Advisor"}
  }'::jsonb,
  '{
    "dashboard": {"enabled": true, "text": "Visão geral das finanças"},
    "transactions": {"enabled": true, "unlimited": true, "text": "Lançamentos ilimitados"},
    "accounts": {"enabled": true, "text": "Contas bancárias ilimitadas"},
    "credit_cards": {"enabled": true, "text": "Controle de cartões de crédito"},
    "categories": {"enabled": true, "text": "Categorização personalizada"},
    "budgets": {"enabled": true, "text": "Orçamentos mensais por categoria"},
    "debts": {"enabled": true, "text": "Controle e negociação de dívidas"},
    "receivables": {"enabled": true, "text": "Gestão de recebíveis"},
    "investments": {"enabled": true, "text": "Acompanhamento de investimentos"},
    "assets": {"enabled": false, "text": "Gestão de patrimônio e bens"},
    "goals": {"enabled": true, "text": "Metas financeiras com projeções"},
    "reports": {"enabled": false, "text": "Relatórios detalhados e exportação"},
    "integrations": {"enabled": false, "text": "WhatsApp + Open Finance"},
    "ai_advisor": {"enabled": true, "limit": 10, "text": "AI Advisor (10 consultas/mês)"}
  }'::jsonb,
  '{
    "dashboard": {"enabled": true, "text": "Visão geral das finanças"},
    "transactions": {"enabled": true, "unlimited": true, "text": "Lançamentos ilimitados"},
    "accounts": {"enabled": true, "text": "Contas bancárias ilimitadas"},
    "credit_cards": {"enabled": true, "text": "Controle de cartões de crédito"},
    "categories": {"enabled": true, "text": "Categorização personalizada"},
    "budgets": {"enabled": true, "text": "Orçamentos mensais por categoria"},
    "debts": {"enabled": true, "text": "Controle e negociação de dívidas"},
    "receivables": {"enabled": true, "text": "Gestão de recebíveis"},
    "investments": {"enabled": true, "text": "Acompanhamento de investimentos"},
    "assets": {"enabled": true, "text": "Gestão de patrimônio e bens"},
    "goals": {"enabled": true, "text": "Metas financeiras com projeções"},
    "reports": {"enabled": true, "text": "Relatórios detalhados e exportação"},
    "integrations": {"enabled": true, "text": "WhatsApp + Open Finance"},
    "ai_advisor": {"enabled": true, "unlimited": true, "text": "AI Advisor ilimitado"}
  }'::jsonb,
  '{
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
  
