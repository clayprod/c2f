# Solução: Emails de Verificação e Reset de Senha Não Chegam

## ⚠️ PROBLEMA IDENTIFICADO

Os emails de verificação de novo usuário e reset de senha não estão chegando, mesmo com SMTP configurado corretamente.

## 🔍 CAUSA MAIS PROVÁVEL (90% dos casos)

**Templates de email no Supabase usando `{{ .Token }}` em vez de `{{ .TokenHash }}`**

Como você está usando Next.js com SSR, o Supabase usa o **PKCE flow**, que requer `token_hash` nos links de email.

## ✅ SOLUÇÃO IMEDIATA

### Passo 1: Corrigir Template de Confirmação de Signup

1. **Acesse o Dashboard do Supabase:**
   - https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates

2. **Selecione "Confirm signup"**

3. **Substitua o link por este código:**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email - c2Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h1 style="margin: 0 0 20px; color: #333; font-size: 24px;">Confirme seu cadastro</h1>
              
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Olá! Obrigado por se cadastrar no <strong>c2Finance</strong>.
              </p>
              
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para confirmar seu email e ativar sua conta:
              </p>

              <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup" 
                 style="display: inline-block; padding: 12px 24px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 30px;">
                Confirmar Email
              </a>

              <p style="margin: 30px 0 0; padding: 12px; background-color: #f5f5f5; border-radius: 4px; word-break: break-all; color: #666; font-size: 12px; font-family: monospace;">
                {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
              </p>

              <p style="margin: 30px 0 0; color: #999; font-size: 12px; line-height: 1.6;">
                Este link expira em 24 horas. Se você não criou esta conta, ignore este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**⚠️ IMPORTANTE:** O link DEVE usar `{{ .TokenHash }}` e não `{{ .Token }}`

### Passo 2: Corrigir Template de Reset de Senha

1. **Ainda no Dashboard do Supabase:**
   - https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates

2. **Selecione "Reset password" (ou "Recovery")**

3. **Substitua o link por este código:**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir senha - c2Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h1 style="margin: 0 0 20px; color: #333; font-size: 24px;">Redefinir sua senha</h1>
              
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Você solicitou a redefinição de senha da sua conta no <strong>c2Finance</strong>.
              </p>
              
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" 
                 style="display: inline-block; padding: 12px 24px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 30px;">
                Redefinir Senha
              </a>

              <p style="margin: 30px 0 0; padding: 12px; background-color: #f5f5f5; border-radius: 4px; word-break: break-all; color: #666; font-size: 12px; font-family: monospace;">
                {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
              </p>

              <p style="margin: 30px 0 0; color: #999; font-size: 12px; line-height: 1.6;">
                Este link expira em 1 hora. Se você não solicitou esta alteração, ignore este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**⚠️ IMPORTANTE:** O link DEVE usar `{{ .TokenHash }}` e não `{{ .Token }}`

### Passo 3: Verificar Configuração SMTP

1. **Acesse:** https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/smtp

2. **Verifique:**
   - ✅ "Enable custom SMTP" está **ATIVADO**
   - ✅ Host SMTP está correto
   - ✅ Porta está correta (587 ou 465)
   - ✅ Usuário e senha estão corretos
   - ✅ Email sender está configurado

### Passo 4: Verificar Rate Limits

1. **Acesse:** https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/rate-limits

2. **Verifique se o limite de emails por hora não foi atingido**
   - Padrão: 30 emails/hora com SMTP customizado
   - Aumente se necessário

### Passo 5: Verificar Redirect URLs

1. **Acesse:** https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/url-configuration

2. **Certifique-se de que estas URLs estão na lista:**
   - `https://c2finance.com.br/auth/confirm`
   - `https://c2finance.com.br/reset-password`
   - `http://localhost:3000/auth/confirm` (para desenvolvimento)

### Passo 6: Testar

1. **Crie um novo usuário de teste**
2. **Verifique os logs imediatamente:**
   - https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/logs/auth-logs
   - Procure por `user_confirmation_requested`
3. **Verifique o email:**
   - Caixa de entrada
   - Spam
   - Aguarde alguns minutos (pode haver delay)

## 🔍 OUTRAS CAUSAS POSSÍVEIS

### 1. Emails Indo para Spam

- Configure SPF, DKIM e DMARC no seu domínio
- Use um domínio customizado para envio
- Peça para o usuário verificar a pasta de spam

### 2. Problema com o Serviço SMTP

- Verifique os logs do seu provedor SMTP (Resend, AWS SES, etc.)
- Teste as credenciais SMTP manualmente
- Verifique se o domínio/email está verificado no serviço SMTP

### 3. Email Confirmations Desabilitadas

1. **Acesse:** https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/providers
2. **Clique em "Email"**
3. **Verifique se "Enable email confirmations" está ATIVADO**

## 📋 CHECKLIST FINAL

- [ ] Template "Confirm signup" usa `{{ .TokenHash }}`
- [ ] Template "Reset password" usa `{{ .TokenHash }}`
- [ ] SMTP customizado está habilitado
- [ ] Credenciais SMTP estão corretas
- [ ] Rate limits não foram atingidos
- [ ] Redirect URLs estão configuradas
- [ ] Email confirmations estão habilitadas
- [ ] Testou criando um novo usuário
- [ ] Verificou os logs do Supabase
- [ ] Verificou a pasta de spam

## 📚 REFERÊNCIAS

- [Documentação Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Templates de Email - EMAIL_TEMPLATE_RECOVERY.md](./EMAIL_TEMPLATE_RECOVERY.md)
- [Setup SMTP - EMAIL_SMTP_SETUP.md](./EMAIL_SMTP_SETUP.md)
- [Diagnóstico Completo - DIAGNOSTICO_EMAILS.md](./DIAGNOSTICO_EMAILS.md)


