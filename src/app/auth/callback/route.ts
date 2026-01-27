import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  // Usar o parâmetro next da query string, ou padrão para /app
  const next = searchParams.get('next') || '/app';

  // Log para debugging
  console.log('Auth callback:', {
    url: request.url,
    code: code ? 'present' : 'missing',
    error,
    errorDescription,
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
    if (next !== '/app') {
      loginUrl.searchParams.set('next', next);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Exchange code error:', exchangeError);
        throw exchangeError;
      }

      // Verificar se a sessão foi estabelecida corretamente
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('Get user error:', userError);
        throw userError;
      }

      if (user) {
        console.log('Auth successful for user:', user.id);

        // Forçar /app se por algum motivo 'next' veio vazio ou como home
        const targetPath = (next === '/' || !next) ? '/app' : next;

        // Usar a origem da requisição, mas tratar casos de localhost/0.0.0.0
        let redirectBase = origin;
        if (redirectBase.includes('0.0.0.0')) {
          redirectBase = redirectBase.replace('0.0.0.0', 'localhost');
        }

        // Criar a URL absoluta de redirecionamento baseada na origem atual
        const redirectUrl = new URL(targetPath, redirectBase).toString();

        console.log('Redirecting to:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error: any) {
      console.error('Auth callback error:', error);
    }
  }

  // Retornar para página de erro se algo der errado
  console.log('No code or error occurred, redirecting to error page. Origin:', origin);
  const errorBase = origin.includes('0.0.0.0') ? origin.replace('0.0.0.0', 'localhost') : origin;
  return NextResponse.redirect(new URL('/auth/auth-code-error', errorBase).toString());
}
