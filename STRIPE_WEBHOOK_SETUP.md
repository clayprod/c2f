# Como Obter o STRIPE_WEBHOOK_SECRET

## Passo a Passo

### 1. Acesse o Stripe Dashboard
- Vá para: https://dashboard.stripe.com
- Faça login na sua conta

### 2. Navegue até Webhooks
- No menu lateral, clique em **"Developers"** → **"Webhooks"**
- Ou acesse diretamente: https://dashboard.stripe.com/webhooks

### 3. Criar um Novo Webhook
- Clique no botão **"+ Add endpoint"** (ou "Add webhook endpoint")
- Preencha os campos:
  - **Endpoint URL**: `https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook`
  - **Description** (opcional): "c2Finance Billing Webhook"

### 4. Selecionar Eventos
Selecione os seguintes eventos que o sistema precisa escutar:

#### Eventos Obrigatórios:
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

#### Opcional (recomendado):
- `customer.subscription.trial_will_end`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

**Dica**: Você pode selecionar "Select all events" para receber todos, mas os 5 acima são os mínimos necessários.

### 5. Obter o Signing Secret
- Após criar o webhook, clique nele para ver os detalhes
- Na seção **"Signing secret"**, clique em **"Reveal"** ou **"Click to reveal"**
- Copie o valor que começa com `whsec_...`
- Este é o seu `STRIPE_WEBHOOK_SECRET`

### 6. Adicionar ao .env
Adicione a linha ao seu arquivo `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ⚠️ IMPORTANTE: Price IDs vs Product IDs

Você forneceu:
- `STRIPE_PRICE_ID_PRO=prod_Tgp6Ya9WSUEpv4`
- `STRIPE_PRICE_ID_BUSINESS=prod_Tgp66ZCWPO08GX`

**Esses são Product IDs (`prod_...`), não Price IDs (`price_...`)!**

O sistema precisa dos **Price IDs**, não dos Product IDs.

### Como Obter os Price IDs Corretos:

1. Vá para: https://dashboard.stripe.com/products
2. Clique no produto "Pro Plan"
3. Na seção **"Pricing"**, você verá os preços (prices)
4. Copie o **Price ID** que começa com `price_...` (não o Product ID)
5. Repita para o "Business Plan"

**Exemplo:**
- ❌ `STRIPE_PRICE_ID_PRO=prod_Tgp6Ya9WSUEpv4` (Product ID - ERRADO)
- ✅ `STRIPE_PRICE_ID_PRO=price_1ABC123xyz...` (Price ID - CORRETO)

## Testando o Webhook

Após configurar, você pode testar:

1. **Via Stripe Dashboard**:
   - Vá para o webhook criado
   - Clique em "Send test webhook"
   - Selecione um evento (ex: `customer.subscription.created`)
   - Verifique se recebeu status 200

2. **Via Logs**:
   - Verifique os logs do seu servidor
   - O endpoint `/api/billing/webhook` deve processar os eventos

## Segurança

⚠️ **NUNCA** compartilhe o `STRIPE_WEBHOOK_SECRET` publicamente!

Este secret é usado para validar que os webhooks realmente vêm do Stripe e não de um atacante.





