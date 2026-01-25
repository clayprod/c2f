import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handler para confirmação de email e recuperação de senha do Supabase
 * 
 * O Supabase envia links no formato:
 * - Confirmação de email: /auth/confirm?token_hash=xxx&type=email
 * - Recuperação de senha: /auth/confirm?token_hash=xxx&type=recovery
 * - Magic link: /auth/confirm?token_hash=xxx&type=magiclink
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/app';

  // Detectar host correto para redirecionamentos
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  
  const getRedirectUrl = (path: string) => {
    if (isLocalEnv) {
      return `${origin}${path}`;
    } else if (forwardedHost) {
      return `https://${forwardedHost}${path}`;
    } else {
      return `${origin}${path}`;
    }
  };

  if (tokenHash && type) {
    const supabase = await createClient();
    
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });

    if (!error) {
      // Sucesso na verificação
      switch (type) {
        case 'email':
        case 'signup':
          // Confirmação de email - redirecionar para página de sucesso
          return NextResponse.redirect(getRedirectUrl('/auth/email-confirmed'));
          
        case 'recovery':
          // Recuperação de senha - redirecionar para página de redefinição
          // A sessão já está ativa, o usuário pode redefinir a senha
          return NextResponse.redirect(getRedirectUrl('/reset-password'));
          
        case 'magiclink':
          // Magic link - redirecionar para o app
          return NextResponse.redirect(getRedirectUrl(next));
          
        case 'invite':
          // Convite - redirecionar para completar cadastro ou app
          return NextResponse.redirect(getRedirectUrl(next));
          
        default:
          // Tipo desconhecido - redirecionar para o app
          return NextResponse.redirect(getRedirectUrl(next));
      }
    } else {
      // Erro na verificação
      console.error('Erro ao verificar token:', error);
      return NextResponse.redirect(getRedirectUrl(`/auth/error?message=${encodeURIComponent(error.message)}`));
    }
  }

  // Parâmetros ausentes
  return NextResponse.redirect(getRedirectUrl('/auth/error?message=Link inválido ou expirado'));
}
