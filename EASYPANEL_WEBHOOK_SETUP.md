# 🚀 Configuração do Webhook no EasyPanel

## 🎯 Objetivo
Garantir que o endpoint `https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook` esteja acessível publicamente para receber eventos do Stripe.

## 📋 Passo a Passo no EasyPanel

### 1. Verificar Configuração do App

No EasyPanel Dashboard:

#### A) Acesse o App
1. Vá para o projeto/app `tenryu-c2finance`
2. Verifique se o app está **rodando** (status: Running/Active)

#### B) Verificar Porta
- O container Next.js deve estar exposto na porta **3000**
- Verifique em **"Ports"** ou **"Networking"** que a porta 3000 está mapeada

#### C) Verificar Variáveis de Ambiente
1. Vá para **"Environment"** ou **"Variables"**
2. Certifique-se de que todas as variáveis estão configuradas:
   - `STRIPE_WEBHOOK_SECRET=whsec_brQjIzrXYkGeAM9UkSG2kyEXgL9HCBUN`
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `NODE_ENV=production`
   - `PORT=3000`
   - Todas as outras variáveis do `.env`

### 2. Configurar Domínio/Roteamento

#### Opção A: Domínio Automático do EasyPanel (Recomendado)

O EasyPanel geralmente configura automaticamente o roteamento para o domínio fornecido.

1. **Verificar Domínio Configurado**:
   - Vá para **"Settings"** ou **"Domain"**
   - Certifique-se de que `tenryu-c2finance.csvoa5.easypanel.host` está configurado
   - Ou configure um domínio customizado se necessário

2. **Verificar Ingress/Proxy**:
   - O EasyPanel deve rotear automaticamente todas as rotas `/*` para o container
   - O endpoint `/api/billing/webhook` deve ser acessível automaticamente
   - Não precisa de configuração adicional de roteamento

#### Opção B: Verificar Configuração Manual (se necessário)

Se o EasyPanel não rotear automaticamente:

1. **Verificar Ingress Configuration**:
   - Procure por **"Ingress"** ou **"Reverse Proxy"** nas configurações
   - Deve estar configurado para rotear `/*` para o container na porta 3000

2. **Verificar Health Check**:
   - Certifique-se de que o health check está funcionando
   - Endpoint: `/api/health` (já existe no código)

### 3. Testar Acessibilidade do Endpoint

#### Teste 1: Verificar se o endpoint está acessível

```bash
# Teste básico (deve retornar erro de autenticação, mas endpoint funciona)
curl -X POST https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

**Resultado esperado:**
- ✅ **400 Bad Request** ou **401 Unauthorized**: Endpoint está funcionando!
- ❌ **404 Not Found**: Endpoint não está acessível (verificar roteamento)
- ❌ **500 Internal Server Error**: Erro no código (verificar logs)

#### Teste 2: Verificar health endpoint

```bash
curl https://tenryu-c2finance.csvoa5.easypanel.host/api/health
```

**Resultado esperado:**
- ✅ **200 OK** com `{"status": "ok"}`: App está funcionando

#### Teste 3: Verificar logs do container

No EasyPanel:
1. Vá para o app `tenryu-c2finance`
2. Clique em **"Logs"** ou **"Console"**
3. Faça uma requisição de teste
4. Verifique se aparece algum log no container

### 4. Configurar Webhook no Stripe Dashboard

1. **Acesse**: https://dashboard.stripe.com/webhooks
2. **Crie ou edite o webhook**:
   - **Endpoint URL**: `https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook`
   - **Description**: "c2Finance Billing Webhook"
3. **Selecione eventos**:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
4. **Copie o Signing Secret**:
   - Deve ser: `whsec_brQjIzrXYkGeAM9UkSG2kyEXgL9HCBUN`
   - Confirme que está no `.env` do EasyPanel

### 5. Testar Webhook do Stripe

#### Teste via Stripe Dashboard:

1. Vá para o webhook criado no Stripe
2. Clique em **"Send test webhook"**
3. Selecione o evento: `customer.subscription.created`
4. Clique em **"Send test webhook"**

**Verificar:**
- ✅ No Stripe: deve mostrar status **200 OK**
- ✅ No EasyPanel Logs: deve aparecer log de processamento
- ✅ No banco de dados: deve criar registro em `billing_subscriptions`

## 🔧 Troubleshooting

### Problema: Endpoint retorna 404

**Soluções:**
1. ✅ Verificar se o app está rodando no EasyPanel
2. ✅ Verificar se a rota `/api/billing/webhook` existe no código (já existe)
3. ✅ Verificar configuração de roteamento no EasyPanel
4. ✅ Verificar se o Next.js está configurado corretamente (`output: 'standalone'`)

### Problema: Endpoint retorna 500

**Soluções:**
1. ✅ Verificar logs do container no EasyPanel
2. ✅ Verificar se `STRIPE_WEBHOOK_SECRET` está configurado
3. ✅ Verificar se o código do webhook está correto
4. ✅ Verificar conexão com Supabase

### Problema: Webhook não recebe eventos

**Soluções:**
1. ✅ Verificar se o webhook está ativo no Stripe Dashboard
2. ✅ Verificar se a URL está correta (sem trailing slash)
3. ✅ Verificar se o endpoint está acessível publicamente
4. ✅ Verificar logs do Stripe Dashboard (seção "Webhooks" → "Events")

### Problema: Erro de assinatura (signature verification failed)

**Soluções:**
1. ✅ Verificar se `STRIPE_WEBHOOK_SECRET` está correto
2. ✅ Verificar se o webhook secret corresponde ao webhook no Stripe
3. ✅ Verificar se o Next.js está recebendo o body raw (já configurado com `export const runtime = 'nodejs'`)

## 📝 Checklist Final

- [ ] App está rodando no EasyPanel
- [ ] Domínio `tenryu-c2finance.csvoa5.easypanel.host` está configurado
- [ ] Variáveis de ambiente estão configuradas (especialmente `STRIPE_WEBHOOK_SECRET`)
- [ ] Porta 3000 está exposta no container
- [ ] Endpoint `/api/billing/webhook` está acessível publicamente (teste com curl)
- [ ] Webhook criado no Stripe Dashboard
- [ ] URL do webhook está correta: `https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook`
- [ ] Eventos selecionados no webhook
- [ ] Teste de webhook retorna 200 OK no Stripe Dashboard
- [ ] Logs mostram processamento no EasyPanel

## 🚀 Comandos Úteis para Testar

### Teste 1: Verificar se o endpoint está acessível

```bash
# Teste básico (deve retornar erro de autenticação)
curl -X POST https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Teste 2: Verificar health do app

```bash
curl https://tenryu-c2finance.csvoa5.easypanel.host/api/health
```

### Teste 3: Verificar se o app está respondendo

```bash
curl -I https://tenryu-c2finance.csvoa5.easypanel.host/
```

## 📚 Informações Importantes

### Configuração do Next.js

O código já está configurado corretamente:

1. **`next.config.js`**: `output: 'standalone'` - necessário para Docker
2. **`src/app/api/billing/webhook/route.ts`**: 
   - `export const runtime = 'nodejs'` - garante que o body seja raw
   - Lê o body como texto: `await request.text()`
   - Valida assinatura do Stripe

### Porta e Host

- **Porta**: 3000 (padrão do Next.js)
- **Host**: 0.0.0.0 (já configurado no Dockerfile)
- **Protocolo**: HTTPS (EasyPanel fornece SSL automaticamente)

## ✅ Próximos Passos

1. **Testar endpoint localmente** (se possível):
   ```bash
   curl -X POST http://localhost:3000/api/billing/webhook -H "Content-Type: application/json" -d '{}'
   ```

2. **Testar endpoint no EasyPanel**:
   ```bash
   curl -X POST https://tenryu-c2finance.csvoa5.easypanel.host/api/billing/webhook -H "Content-Type: application/json" -d '{}'
   ```

3. **Configurar webhook no Stripe** com a URL do EasyPanel

4. **Testar webhook do Stripe** usando "Send test webhook"

5. **Monitorar logs** no EasyPanel para ver processamento

## 🎉 Conclusão

O endpoint `/api/billing/webhook` já está implementado no código e deve funcionar automaticamente no EasyPanel, desde que:
- O app esteja rodando
- As variáveis de ambiente estejam configuradas
- O domínio esteja configurado corretamente
- O roteamento do EasyPanel esteja funcionando (geralmente automático)

O EasyPanel geralmente configura o roteamento automaticamente, então você só precisa garantir que o app está rodando e as variáveis estão configuradas!
