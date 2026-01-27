# Diagnóstico: Emails de Verificação e Reset de Senha Não Chegam

## Checklist de Diagnóstico Rápido

### 1. ✅ Verificar Templates de Email no Supabase (CRÍTICO)

**O problema mais comum é o template de email incorreto para PKCE flow.**

#### Template de Confirmação de Signup (Confirm signup)

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates
2. Selecione **"Confirm signup"**
3. **VERIFIQUE se o link usa `{{ .TokenHash }}` e não `{{ .Token }}`**

**Template CORRETO:**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
  Confirmar email
</a>
```

**Template INCORRETO (não funciona com PKCE):**
```html
<a href="{{ .SiteURL }}/auth/confirm?token={{ .Token }}&type=signup">
  Confirmar email
</a>
```

#### Template de Reset de Senha (Reset password)

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates
2. Selecione **"Reset password"** (ou "Recovery")
3. **VERIFIQUE se o link usa `{{ .TokenHash }}`**

**Template CORRETO:**
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  Redefinir senha
</a>
```

### 2. ✅ Verificar Configuração SMTP

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/smtp
2. Verifique:
   - ✅ **"Enable custom SMTP"** está **ATIVADO**
   - ✅ Host SMTP está correto
   - ✅ Porta está correta (587 ou 465)
   - ✅ Usuário e senha estão corretos
   - ✅ Email sender está configurado

### 3. ✅ Verificar Rate Limits

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/rate-limits
2. Verifique se o limite de emails por hora não foi atingido
3. O padrão com SMTP customizado é 30 emails/hora

### 4. ✅ Verificar Redirect URLs

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/url-configuration
2. Certifique-se de que estas URLs estão na lista de **Redirect URLs**:
   - `https://c2finance.com.br/auth/confirm`
   - `https://c2finance.com.br/reset-password`
   - `http://localhost:3000/auth/confirm` (para desenvolvimento)

### 5. ✅ Verificar Logs do Supabase Auth

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/logs/auth-logs
2. Procure por:
   - Eventos `user_confirmation_requested` (signup)
   - Eventos `user_recovery_requested` (reset password)
   - Erros relacionados a SMTP
   - Mensagens de "Email address not authorized"
   - Rate limit exceeded

### 6. ✅ Verificar Configuração de Email Confirmations

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/providers
2. Clique em **Email**
3. Verifique se **"Enable email confirmations"** está **ATIVADO**

## Teste Passo a Passo

### Teste 1: Criar Novo Usuário

1. Acesse: https://c2finance.com.br/signup
2. Preencha o formulário e crie uma conta
3. **Imediatamente após criar**, verifique os logs:
   - https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/logs/auth-logs
   - Procure por `user_confirmation_requested`
4. Se aparecer `user_confirmation_requested` mas o email não chegar:
   - ✅ Problema é com SMTP ou template
   - Verifique template (Passo 1)
   - Verifique SMTP (Passo 2)
5. Se NÃO aparecer `user_confirmation_requested`:
   - ✅ Problema é com configuração de email confirmations
   - Verifique Passo 6

### Teste 2: Reset de Senha

1. Acesse: https://c2finance.com.br/forgot-password
2. Digite um email válido
3. **Imediatamente após enviar**, verifique os logs:
   - Procure por `user_recovery_requested`
4. Se aparecer `user_recovery_requested` mas o email não chegar:
   - ✅ Problema é com SMTP ou template
   - Verifique template (Passo 1)
   - Verifique SMTP (Passo 2)

## Soluções Mais Comuns

### Solução 1: Corrigir Template de Email (90% dos casos)

**Para Signup:**
1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates
2. Selecione **"Confirm signup"**
3. Substitua o link por:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
  Confirmar email
</a>
```
4. Salve

**Para Reset de Senha:**
1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates
2. Selecione **"Reset password"**
3. Substitua o link por:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  Redefinir senha
</a>
```
4. Salve

### Solução 2: Verificar Credenciais SMTP

1. Teste as credenciais SMTP manualmente usando um cliente de email
2. Verifique se o domínio/email sender está verificado no serviço SMTP
3. Verifique os logs do seu provedor SMTP (Resend, AWS SES, etc.)

### Solução 3: Verificar se Emails Estão Indo para Spam

- Peça para o usuário verificar a pasta de spam
- Configure SPF, DKIM e DMARC no seu domínio
- Use um domínio customizado para envio

## Próximos Passos

1. ✅ Verificar templates de email (prioridade máxima)
2. ✅ Verificar logs do Supabase Auth
3. ✅ Verificar rate limits
4. ✅ Testar credenciais SMTP
5. ✅ Verificar configuração de SPF/DKIM/DMARC
6. ✅ Verificar logs do provedor SMTP

## Referências

- [Documentação Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Templates de Email - EMAIL_TEMPLATE_RECOVERY.md](./EMAIL_TEMPLATE_RECOVERY.md)
- [Setup SMTP - EMAIL_SMTP_SETUP.md](./EMAIL_SMTP_SETUP.md)


