# Troubleshooting: Emails de Confirmação Não Estão Sendo Enviados

## Problema Identificado

Mesmo com SMTP configurado, os emails de confirmação podem não estar sendo enviados por várias razões. Este documento lista as causas mais comuns e como resolver.

## Checklist de Verificação

### 1. ✅ Verificar se SMTP está realmente habilitado

Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/smtp

- Verifique se "Enable custom SMTP" está **ativado**
- Verifique se as credenciais SMTP estão corretas
- Teste as credenciais se possível

### 2. ⚠️ **IMPORTANTE: Template de Email para PKCE Flow**

Como você está usando **Next.js com SSR**, o Supabase usa o **PKCE flow**. O template de email **DEVE** incluir `token_hash` no link, não apenas `token`.

**Template CORRETO para confirmação de signup:**

```html
<h2>Confirme seu cadastro</h2>

<p>Clique no link abaixo para confirmar seu email:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}">
    Confirmar email
  </a>
</p>
```

**Onde configurar:**
1. Dashboard Supabase → **Authentication** → **Email Templates**
2. Selecione o template **"Confirm signup"**
3. Certifique-se de que o link usa `{{ .TokenHash }}` e não `{{ .Token }}`
4. O link deve apontar para `/auth/confirm?token_hash=...&type=signup`

### 3. Verificar Rate Limits

Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/rate-limits

- Verifique se o limite de emails por hora não foi atingido
- O padrão com SMTP customizado é 30 emails/hora
- Aumente conforme necessário

### 4. Verificar Logs do Supabase

Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/logs/auth-logs

Procure por:
- Erros relacionados a SMTP
- Mensagens de "Email address not authorized" (se ainda estiver usando SMTP padrão)
- Erros de autenticação SMTP
- Rate limit exceeded

### 5. Verificar Configuração do Serviço SMTP

**Problemas comuns:**
- Credenciais SMTP incorretas ou expiradas
- Porta SMTP bloqueada (587 ou 465)
- Domínio/email sender não verificado
- Serviço SMTP com problemas ou bloqueado

**Como testar:**
- Tente enviar um email de teste manualmente usando as mesmas credenciais
- Verifique os logs do seu provedor SMTP (Resend, AWS SES, etc.)

### 6. Verificar se Emails Estão Indo para Spam

- Peça para o usuário verificar a pasta de spam
- Configure SPF, DKIM e DMARC no seu domínio
- Use um domínio customizado para envio (não use o domínio padrão do Supabase)

### 7. Verificar Redirect URLs

Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/url-configuration

Certifique-se de que `https://c2finance.com.br/auth/confirm` está na lista de **Redirect URLs** permitidas.

## Solução Mais Provável: Template de Email Incorreto

Se o SMTP já está configurado mas os emails não chegam, a causa mais comum é o **template de email incorreto para PKCE flow**.

### Como Corrigir o Template

1. **Acesse o Dashboard:**
   - https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates

2. **Edite o template "Confirm signup":**

   O template deve ter este formato:

   ```html
   <h2>Confirme seu cadastro</h2>
   
   <p>Clique no link abaixo para confirmar seu email:</p>
   <p>
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
       Confirmar email
     </a>
   </p>
   ```

   **Variáveis disponíveis:**
   - `{{ .SiteURL }}` - URL do site (ex: https://c2finance.com.br)
   - `{{ .TokenHash }}` - Hash do token (OBRIGATÓRIO para PKCE)
   - `{{ .Token }}` - Token OTP (6 dígitos, opcional)
   - `{{ .RedirectTo }}` - URL de redirecionamento após confirmação

3. **Salve o template**

4. **Teste criando um novo usuário**

### Exemplo Completo de Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirme seu email</title>
</head>
<body>
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Bem-vindo ao c2Finance!</h2>
    
    <p>Olá,</p>
    
    <p>Obrigado por se cadastrar. Para ativar sua conta, clique no botão abaixo:</p>
    
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup" 
         style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Confirmar Email
      </a>
    </p>
    
    <p>Ou copie e cole este link no seu navegador:</p>
    <p style="word-break: break-all; color: #6B7280;">
      {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
    </p>
    
    <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">
      Se você não criou esta conta, pode ignorar este email.
    </p>
  </div>
</body>
</html>
```

## Outras Causas Possíveis

### Rate Limit Atingido

Se você enviou muitos emails recentemente, pode ter atingido o limite. Verifique:
- Dashboard → Authentication → Rate Limits
- Logs → Auth Logs (procure por "rate limit")

### Problema com o Serviço SMTP

- **Resend**: Verifique se a API key está válida e se o domínio está verificado
- **AWS SES**: Verifique se está fora do "sandbox mode" ou se o email está verificado
- **Outros**: Verifique os logs do seu provedor SMTP

### Emails Bloqueados pelo Provedor de Email

Alguns provedores (Gmail, Outlook, etc.) podem bloquear emails de domínios não verificados. Configure:
- SPF records
- DKIM signatures
- DMARC policy

## Teste Rápido

Para testar se o problema é com o template ou com o SMTP:

1. Crie um novo usuário de teste
2. Verifique os logs do Supabase Auth
3. Se aparecer "user_confirmation_requested" mas o email não chegar, o problema é:
   - Template incorreto (mais provável)
   - SMTP não configurado corretamente
   - Rate limit atingido
   - Email bloqueado pelo provedor

## Diagnóstico Passo a Passo

### Passo 1: Verificar se o Email Está Sendo Enviado

1. **Acesse os logs do Supabase:**
   - https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/logs/auth-logs
   - Procure por eventos `user_confirmation_requested`
   - Se aparecer, o Supabase está tentando enviar
   - Se NÃO aparecer, o problema é no signup

2. **Procure por erros específicos:**
   - `SMTP error`
   - `Email address not authorized`
   - `Rate limit exceeded`
   - `Failed to send email`

### Passo 2: Verificar Template de Email (CRÍTICO)

**O template DEVE usar `token_hash` para PKCE flow:**

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates
2. Selecione **"Confirm signup"**
3. Verifique se o link está assim:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
```

**NÃO use:**
- `{{ .Token }}` (isso é para implicit flow, não PKCE)
- `{{ .ConfirmationURL }}` (pode não funcionar com PKCE)

### Passo 3: Verificar Configuração SMTP

1. **Acesse:** https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/smtp
2. **Verifique:**
   - ✅ "Enable custom SMTP" está **ATIVADO**
   - ✅ Host SMTP está correto
   - ✅ Porta está correta (587 ou 465)
   - ✅ Usuário e senha estão corretos
   - ✅ Email sender está configurado

3. **Teste as credenciais:**
   - Tente enviar um email manualmente usando as mesmas credenciais
   - Use um cliente SMTP (como Thunderbird) ou ferramenta online

### Passo 4: Verificar Rate Limits

1. **Acesse:** https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/rate-limits
2. **Verifique:**
   - Limite de emails por hora
   - Se você enviou muitos emails recentemente, pode ter atingido o limite
   - Aumente o limite se necessário

### Passo 5: Verificar Logs do Provedor SMTP

Se você está usando:
- **Resend**: Verifique os logs em https://resend.com/emails
- **AWS SES**: Verifique no AWS Console → SES → Sending Statistics
- **SendGrid**: Verifique em Activity Feed
- **Outros**: Verifique os logs do seu provedor

### Passo 6: Verificar se Email Está Indo para Spam

- Peça para o usuário verificar a pasta de spam
- Configure SPF, DKIM e DMARC no seu domínio
- Use um domínio customizado para envio

### Passo 7: Teste Manual

1. **Crie um novo usuário de teste**
2. **Verifique os logs imediatamente:**
   - Procure por `user_confirmation_requested`
   - Procure por erros de SMTP
3. **Verifique o email:**
   - Caixa de entrada
   - Spam
   - Aguarde alguns minutos (pode haver delay)

## Solução de Problemas Específicos

### Problema: "user_confirmation_requested" aparece mas email não chega

**Causas possíveis:**
1. Template de email incorreto (mais provável)
2. SMTP configurado mas com credenciais incorretas
3. Email bloqueado pelo provedor SMTP
4. Email indo para spam

**Solução:**
1. Verifique o template (Passo 2)
2. Teste as credenciais SMTP manualmente
3. Verifique os logs do provedor SMTP
4. Configure SPF/DKIM/DMARC

### Problema: Nenhum evento "user_confirmation_requested" aparece

**Causas possíveis:**
1. Email confirmations desabilitadas
2. Problema no código de signup
3. Rate limit atingido antes do signup

**Solução:**
1. Verifique: Dashboard → Authentication → Providers → Email → "Enable email confirmations"
2. Verifique o código de signup
3. Verifique rate limits

### Problema: Erro "Email address not authorized"

**Causa:**
- Ainda está usando SMTP padrão (não customizado)

**Solução:**
- Configure SMTP customizado (veja seção "Como Configurar" acima)

## Próximos Passos

1. ✅ Verificar template de email (prioridade máxima)
2. ✅ Verificar logs do Supabase Auth
3. ✅ Verificar rate limits
4. ✅ Testar credenciais SMTP
5. ✅ Verificar configuração de SPF/DKIM/DMARC
6. ✅ Verificar logs do provedor SMTP

## Solução: Configurar SMTP Customizado

Para enviar emails para qualquer endereço, você precisa configurar um servidor SMTP customizado.

### Opções Recomendadas de Serviços SMTP

1. **Resend** (Recomendado para começar)
   - Grátis até 3.000 emails/mês
   - Fácil configuração
   - Boa documentação: https://resend.com/docs/send-with-supabase-smtp

2. **AWS SES** (Recomendado para produção)
   - Muito barato ($0.10 por 1.000 emails)
   - Altamente confiável
   - Documentação: https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html

3. **Outras opções:**
   - Postmark
   - Twilio SendGrid
   - Brevo (antigo Sendinblue)
   - ZeptoMail

### Como Configurar

#### Opção 1: Via Dashboard do Supabase (Mais Fácil)

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto: **c2finance**
3. Vá em **Authentication** → **SMTP Settings**
4. Configure:
   - **Enable custom SMTP**: Ativar
   - **SMTP Host**: (ex: `smtp.resend.com` ou `email-smtp.us-east-1.amazonaws.com`)
   - **SMTP Port**: (ex: `587` ou `465`)
   - **SMTP User**: Seu usuário SMTP
   - **SMTP Password**: Sua senha SMTP
   - **Sender email**: `no-reply@c2finance.com.br` (ou seu domínio)
   - **Sender name**: `c2Finance`

#### Opção 2: Via Management API

```bash
# Obter access token em: https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="seu-access-token"
export PROJECT_REF="ndlqyqfxvlalootwdjxv"

# Configurar SMTP customizado
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_email_enabled": true,
    "mailer_secure_email_change_enabled": true,
    "mailer_autoconfirm": false,
    "smtp_admin_email": "no-reply@c2finance.com.br",
    "smtp_host": "smtp.resend.com",
    "smtp_port": 587,
    "smtp_user": "resend",
    "smtp_pass": "sua-senha-smtp",
    "smtp_sender_name": "c2Finance"
  }'
```

### Exemplo: Configuração com Resend

1. **Criar conta no Resend:**
   - Acesse: https://resend.com
   - Crie uma conta gratuita
   - Vá em **API Keys** e crie uma nova chave

2. **Configurar domínio (opcional mas recomendado):**
   - Adicione seu domínio `c2finance.com.br`
   - Configure os registros DNS (SPF, DKIM, DMARC)
   - Aguarde a verificação

3. **Obter credenciais SMTP:**
   - No Resend, vá em **SMTP**
   - Use:
     - Host: `smtp.resend.com`
     - Port: `587`
     - Username: `resend`
     - Password: Sua API key do Resend

4. **Configurar no Supabase:**
   - Use as credenciais acima no dashboard do Supabase

### Exemplo: Configuração com AWS SES

1. **Criar conta AWS SES:**
   - Acesse AWS Console → SES
   - Verifique seu domínio ou email
   - Crie credenciais SMTP

2. **Configurar no Supabase:**
   - Use as credenciais SMTP do AWS SES

### Ajustar Rate Limits

Após configurar SMTP customizado, ajuste os rate limits:

1. No Dashboard do Supabase: **Authentication** → **Rate Limits**
2. Aumente o limite de emails por hora conforme necessário
3. O padrão é 30 emails/hora (pode ser aumentado)

### Verificar Configuração

Após configurar:

1. Teste criando um novo usuário
2. Verifique se o email de confirmação foi enviado
3. Verifique os logs do Supabase: **Logs** → **Auth**

### Troubleshooting

- **Emails não estão sendo enviados:**
  - Verifique se o SMTP customizado está habilitado
  - Verifique as credenciais SMTP
  - Verifique os logs do Supabase Auth
  - Verifique se o domínio/email está verificado no serviço SMTP

- **Emails vão para spam:**
  - Configure SPF, DKIM e DMARC no seu domínio
  - Use um domínio customizado para envio
  - Evite conteúdo que pareça marketing nos templates de email

### Próximos Passos

1. ✅ Configurar SMTP customizado (Resend ou AWS SES)
2. ✅ Testar envio de email de confirmação
3. ✅ Ajustar rate limits conforme necessário
4. ✅ Configurar templates de email customizados (opcional)

## Referências

- [Documentação Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend + Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [AWS SES SMTP](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html)

