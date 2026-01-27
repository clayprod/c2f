import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') || '/app';

  // Log para debugging
  console.log('Auth callback:', {
    url: request.url,
    code: code ? 'present' : 'missing',
    next,
    origin
  });

  // Se houver erro direto do OAuth, redirecionar para login com mensagem
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', error);
    if (errorDescription) {
      loginUrl.searchParams.set('error_description', errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) throw exchangeError;

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (user) {
        // Redirecionamento inteligente:
        // Se estamos no domínio de produção ou em ambiente de produção, forçamos o domínio real.
        // Caso contrário (localhost), usamos a origem da requisição.
        let redirectBase: string;

        if (process.env.NODE_ENV === 'production' || origin.includes('c2finance.com.br')) {
          redirectBase = 'https://c2finance.com.br';
        } else {
          redirectBase = origin.replace('0.0.0.0', 'localhost');
        }

        // Forçar /app se por algum motivo 'next' veio vazio ou como home
        const targetPath = (next === '/' || !next) ? '/app' : next;
        const redirectUrl = new URL(targetPath, redirectBase).toString();

        console.log('Redirecting to:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error: any) {
      console.error('Auth callback error:', error);
    }
  }

  // Fallback de erro
  const errorBase = (process.env.NODE_ENV === 'production' || origin.includes('c2finance.com.br'))
    ? 'https://c2finance.com.br'
    : origin.replace('0.0.0.0', 'localhost');

  return NextResponse.redirect(new URL('/auth/auth-code-error', errorBase).toString());
}
