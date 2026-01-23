interface InviteEmailData {
  ownerName: string;
  ownerEmail: string;
  inviteLink: string;
  role: string;
  expiresAt: string;
}

interface AccessRemovedEmailData {
  ownerName: string;
  ownerEmail: string;
}

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
  .logo { font-size: 24px; font-weight: bold; color: #8b5cf6; }
  .content { padding: 30px 0; }
  .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
  .button:hover { opacity: 0.9; }
  .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
  .role-badge { display: inline-block; padding: 4px 12px; background: #e9d5ff; color: #7c3aed; border-radius: 4px; font-size: 14px; font-weight: 500; }
`;

function wrapTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">c2Finance</div>
    </div>
    ${content}
    <div class="footer">
      <p>Este email foi enviado pelo c2Finance.</p>
      <p>Se você não esperava este email, pode ignorá-lo com segurança.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

const roleLabels: Record<string, string> = {
  viewer: 'Visualizador',
  editor: 'Editor',
  admin: 'Administrador',
};

export function inviteNewUserTemplate(data: InviteEmailData): { subject: string; html: string } {
  const roleLabel = roleLabels[data.role] || data.role;
  
  const content = `
    <div class="content">
      <h2>Você foi convidado para compartilhar uma conta!</h2>
      <p><strong>${data.ownerName}</strong> (${data.ownerEmail}) convidou você para acessar a conta financeira dele no c2Finance.</p>
      
      <div class="info-box">
      <p><strong>Nível de acesso:</strong> <span class="role-badge">${roleLabel}</span></p>
        <p><strong>Válido até:</strong> ${data.expiresAt}</p>
      </div>
      
      <p>Para aceitar o convite e criar sua conta, clique no botão abaixo:</p>
      
      <p style="text-align: center;">
        <a href="${data.inviteLink}" class="button">Aceitar Convite e Criar Conta</a>
      </p>
      
      <p style="font-size: 14px; color: #666;">
        Ou copie e cole este link no seu navegador:<br>
        <a href="${data.inviteLink}" style="color: #8b5cf6;">${data.inviteLink}</a>
      </p>
    </div>
  `;
  
  return {
    subject: `${data.ownerName} convidou você para o c2Finance`,
    html: wrapTemplate(content),
  };
}

export function inviteExistingUserTemplate(data: InviteEmailData): { subject: string; html: string } {
  const roleLabel = roleLabels[data.role] || data.role;
  
  const content = `
    <div class="content">
      <h2>Novo acesso compartilhado!</h2>
      <p><strong>${data.ownerName}</strong> (${data.ownerEmail}) compartilhou a conta financeira dele com você no c2Finance.</p>
      
      <div class="info-box">
      <p><strong>Nível de acesso:</strong> <span class="role-badge">${roleLabel}</span></p>
        <p><strong>Válido até:</strong> ${data.expiresAt}</p>
      </div>
      
      <p>Para aceitar o convite, clique no botão abaixo:</p>
      
      <p style="text-align: center;">
        <a href="${data.inviteLink}" class="button">Aceitar Convite</a>
      </p>
      
      <p style="font-size: 14px; color: #666;">
        Ou copie e cole este link no seu navegador:<br>
        <a href="${data.inviteLink}" style="color: #8b5cf6;">${data.inviteLink}</a>
      </p>
      
      <p>Após aceitar, você poderá alternar entre sua conta e a conta compartilhada a qualquer momento.</p>
    </div>
  `;
  
  return {
    subject: `${data.ownerName} compartilhou uma conta com você`,
    html: wrapTemplate(content),
  };
}

export function accessRemovedTemplate(data: AccessRemovedEmailData): { subject: string; html: string } {
  const content = `
    <div class="content">
      <h2>Acesso removido</h2>
      <p><strong>${data.ownerName}</strong> (${data.ownerEmail}) removeu seu acesso compartilhado a conta financeira dele no c2Finance.</p>
      
      <p>Você não poderá mais visualizar ou editar os dados dessa conta.</p>
      
      <p>Se você acredita que isso foi um erro, entre em contato diretamente com ${data.ownerName}.</p>
      
      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/app" class="button">Acessar Minha Conta</a>
      </p>
    </div>
  `;
  
  return {
    subject: `Acesso removido - c2Finance`,
    html: wrapTemplate(content),
  };
}

export function inviteAcceptedTemplate(data: { memberName: string; memberEmail: string }): { subject: string; html: string } {
  const content = `
    <div class="content">
      <h2>Convite aceito!</h2>
      <p><strong>${data.memberName}</strong> (${data.memberEmail}) aceitou seu convite e agora tem acesso compartilhado a sua conta financeira.</p>
      
      <p>Você pode gerenciar as permissões desse usuário a qualquer momento nas configurações da sua conta.</p>
      
      <p style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/app/settings" class="button">Gerenciar Acessos</a>
      </p>
    </div>
  `;
  
  return {
    subject: `${data.memberName} aceitou seu convite`,
    html: wrapTemplate(content),
  };
}
