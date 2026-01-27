# Template de Email - Recuperação de Senha (Reset Password)

## Template para Supabase Auth - PKCE Flow

Este template é para o fluxo de recuperação de senha (forgot password). Como você está usando Next.js com SSR, o Supabase usa o **PKCE flow**, então o template **DEVE** usar `{{ .TokenHash }}` no link.

## Como Configurar

1. Acesse: https://supabase.com/dashboard/project/ndlqyqfxvlalootwdjxv/auth/templates
2. Selecione o template **"Reset password"** (ou "Recovery")
3. Cole o template HTML abaixo
4. Salve

## Template HTML Completo

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir sua senha - c2Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <div style="width: 60px; height: 60px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">🔒</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Redefinir sua senha</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Olá,
              </p>
              
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>c2Finance</strong>.
              </p>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Redefinir senha
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <p style="margin: 30px 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin: 0 0 30px; padding: 12px; background-color: #f5f5f5; border-radius: 6px; word-break: break-all; color: #333333; font-size: 13px; line-height: 1.5; font-family: 'Courier New', monospace;">
                {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
              </p>

              <!-- Security Notice -->
              <div style="margin: 30px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Importante:</strong> Este link expira em 1 hora. Se você não solicitou a redefinição de senha, ignore este email.
                </p>
              </div>

              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Se você não solicitou esta alteração, pode ignorar este email com segurança. Sua senha permanecerá a mesma.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; color: #666666; font-size: 12px; line-height: 1.6; text-align: center;">
                Este é um email automático, por favor não responda.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6; text-align: center;">
                © {{ .Year }} c2Finance. Todos os direitos reservados.
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

## Template Simplificado (Alternativa)

Se preferir um template mais simples:

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
                Você solicitou a redefinição de senha da sua conta no c2Finance.
              </p>
              
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" 
                 style="display: inline-block; padding: 12px 24px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 30px;">
                Redefinir senha
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

## Variáveis Disponíveis

- `{{ .SiteURL }}` - URL do site (ex: https://c2finance.com.br)
- `{{ .TokenHash }}` - Hash do token (OBRIGATÓRIO para PKCE flow)
- `{{ .Token }}` - Token OTP de 6 dígitos (opcional, para fallback)
- `{{ .RedirectTo }}` - URL de redirecionamento após confirmação
- `{{ .Year }}` - Ano atual (2026)

## ⚠️ IMPORTANTE

1. **Use `{{ .TokenHash }}`** no link, não `{{ .Token }}`
2. **O tipo deve ser `recovery`**: `type=recovery`
3. **O next deve apontar para `/reset-password`**: `next=/reset-password`
4. **URL completa do link:**
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   ```

## Verificação

Após configurar o template:

1. Teste solicitando uma recuperação de senha
2. Verifique se o email chega
3. Verifique se o link funciona corretamente
4. Verifique se redireciona para `/reset-password`

## Troubleshooting

- **Link não funciona**: Verifique se está usando `token_hash` e não `token`
- **Redireciona para lugar errado**: Verifique o parâmetro `next=/reset-password`
- **Email não chega**: Veja o guia `EMAIL_SMTP_SETUP.md`



