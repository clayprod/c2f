# Configuração de Variáveis de Ambiente

## ✅ Variáveis Já Configuradas

- **Supabase**: URL, Anon Key e Service Role Key
- **Groq API**: Para o AI Advisor
- **Pluggy**: Client ID e Secret para integração bancária
- **NextAuth**: URL e Secret (mantido para compatibilidade)

## ⚠️ Variáveis FALTANDO (Obrigatórias)

### 1. Stripe Configuration

O sistema precisa das seguintes variáveis do Stripe para funcionar:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_BUSINESS=price_...
```

#### Como obter:

1. **Acesse o Stripe Dashboard**: https://dashboard.stripe.com
2. **API Keys** (https://dashboard.stripe.com/apikeys):
   - Copie `Secret key` → `STRIPE_SECRET_KEY`
   - Copie `Publishable key` → `STRIPE_PUBLISHABLE_KEY`
3. **Webhooks** (https://dashboard.stripe.com/webhooks):
   - Crie um webhook apontando para: `https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook`
   - Eventos necessários: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
   - Copie o `Signing secret` → `STRIPE_WEBHOOK_SECRET`
4. **Products & Prices** (https://dashboard.stripe.com/products):
   - Crie 2 produtos:
     - **Pro Plan**: Preço mensal (ex: R$ 29,90/mês)
     - **Business Plan**: Preço mensal (ex: R$ 99,90/mês)
   - Copie os `Price ID` de cada um → `STRIPE_PRICE_ID_PRO` e `STRIPE_PRICE_ID_BUSINESS`

## 📝 Variáveis Opcionais

- `OPENAI_API_KEY`: Não usado atualmente (usamos Groq)
- `ANTHROPIC_API_KEY`: Não usado atualmente
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Para login social (não implementado ainda)
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`: Para login social (não implementado ainda)

## 🔒 Segurança

⚠️ **NUNCA** commite o arquivo `.env` no Git!

O arquivo `.env` já está no `.gitignore` e não será versionado.

## ✅ Próximos Passos

1. Configure as variáveis do Stripe (obrigatório)
2. Teste o fluxo de checkout: `/api/billing/checkout`
3. Configure o webhook do Stripe apontando para seu domínio
4. Teste a importação CSV: `/api/import/csv`
5. Teste o AI Advisor: `/api/advisor/chat`


