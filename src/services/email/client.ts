import nodemailer from 'nodemailer';
import { getGlobalSettings } from '@/services/admin/globalSettings';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

let transporter: nodemailer.Transporter | null = null;
let lastConfigHash: string | null = null;

function getConfigHash(settings: any): string {
  return `${settings.smtp_host}:${settings.smtp_port || 587}:${settings.smtp_user}:${settings.smtp_secure}`;
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  const settings = await getGlobalSettings();

  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
    throw new Error('SMTP not configured. Please configure SMTP settings in admin panel.');
  }

  const port = settings.smtp_port || 587;
  const isSecurePort = port === 465;
  const useSecure = typeof settings.smtp_secure === 'boolean' ? settings.smtp_secure : isSecurePort;

  const configHash = getConfigHash(settings);

  // Recreate transporter if config changed
  if (!transporter || lastConfigHash !== configHash) {
    const config: SMTPConfig & { requireTLS?: boolean; tls?: { rejectUnauthorized?: boolean } } = {
      host: settings.smtp_host,
      port: port,
      secure: useSecure,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
    };

    // For port 587 (STARTTLS), require TLS but don't use secure connection initially
    if (port === 587 && !useSecure) {
      config.requireTLS = true;
    }

    // Allow self-signed certificates in development (can be configured via settings)
    if (process.env.NODE_ENV === 'development') {
      config.tls = {
        rejectUnauthorized: false,
      };
    }

    // Close old transporter if exists
    if (transporter) {
      transporter.close();
    }

    transporter = nodemailer.createTransport(config);
    lastConfigHash = configHash;
  }

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  let settings;
  try {
    settings = await getGlobalSettings();
    
    // Validate SMTP configuration before attempting to send
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
      const missingFields = [];
      if (!settings.smtp_host) missingFields.push('smtp_host');
      if (!settings.smtp_user) missingFields.push('smtp_user');
      if (!settings.smtp_password) missingFields.push('smtp_password');
      
      throw new Error(
        `SMTP not configured. Missing fields: ${missingFields.join(', ')}. ` +
        'Please configure SMTP settings in admin panel.'
      );
    }

    const transport = await getTransporter();

    const fromEmail = settings.smtp_from_email || settings.smtp_user;
    
    if (!fromEmail) {
      throw new Error('SMTP from email not configured. Please set smtp_from_email in admin settings.');
    }

    const result = await transport.sendMail({
      from: `"c2Finance" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    console.log('[Email] Sent successfully to', options.to, '- Message ID:', result.messageId);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Email] Failed to send to', options.to, ':', errorMessage);
    if (errorStack) {
      console.error('[Email] Error stack:', errorStack);
    }
    
    // Enhance error message with more context
    if (error instanceof Error && settings) {
      const host = settings.smtp_host || 'N/A';
      const port = settings.smtp_port || 587;
      
      // Check for common SMTP errors
      if (
        errorMessage.includes('ECONNREFUSED') || 
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('connect ECONNREFUSED') ||
        errorMessage.includes('timeout')
      ) {
        let portHint = '';
        if (port === 588) {
          portHint = ' A porta 588 nao e uma porta SMTP padrao. Tente usar 587 (STARTTLS) ou 465 (SSL/TLS).';
        } else if (![25, 465, 587].includes(port)) {
          portHint = ` A porta ${port} pode nao ser suportada. Portas SMTP comuns sao: 587 (STARTTLS) ou 465 (SSL/TLS).`;
        }
        
        throw new Error(
          `Nao foi possivel conectar ao servidor SMTP (${host}:${port}).${portHint} ` +
          'Verifique as configuracoes de host e porta no painel administrativo.'
        );
      }
      
      if (
        errorMessage.includes('Invalid login') || 
        errorMessage.includes('authentication failed') ||
        errorMessage.includes('535') ||
        errorMessage.includes('535-5.7.8')
      ) {
        throw new Error('Autenticacao SMTP falhou. Verifique usuario e senha nas configuracoes do painel administrativo.');
      }
      
      if (
        errorMessage.includes('self signed certificate') ||
        errorMessage.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
        errorMessage.includes('CERT_HAS_EXPIRED')
      ) {
        throw new Error('Certificado SSL invalido ou expirado. Verifique as configuracoes de seguranca SMTP ou entre em contato com o provedor de email.');
      }
      
      if (errorMessage.includes('EHLO') || errorMessage.includes('HELO')) {
        throw new Error(`Erro na comunicacao com o servidor SMTP (${host}:${port}). O servidor pode estar rejeitando conexoes ou a porta pode estar incorreta.`);
      }
    }
    
    // If we couldn't enhance the error, return the original with context
    throw error;
  }
}

export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = await getTransporter();
    await transport.verify();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Clear cached transporter (call when settings change)
export function resetTransporter(): void {
  if (transporter) {
    transporter.close();
  }
  transporter = null;
  lastConfigHash = null;
}
