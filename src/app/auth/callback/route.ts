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
        
        // Redirecionar para o destino especificado (ou /app por padrão)
        let redirectUrl: string;
        
        // Em produção, forçar o domínio correto
        if (process.env.NODE_ENV === 'production' || origin.includes('c2finance.com.br')) {
          redirectUrl = `https://c2finance.com.br${next}`;
        } else {
          // Em desenvolvimento, tratar localhost
          const devOrigin = origin.includes('0.0.0.0') ? origin.replace('0.0.0.0', 'localhost') : origin;
          redirectUrl = `${devOrigin}${next}`;
        }

        console.log('Environment check:', { 
          origin, 
          next, 
          redirectUrl 
        });
        console.log('Redirecting to:', redirectUrl);
        // Usar NextResponse.redirect com URL absoluta
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error: any) {
      console.error('Auth callback error:', error);
    }
  }

  // Retornar para página de erro se algo der errado
  console.log('No code or error occurred, redirecting to error page. Origin:', origin);
  return NextResponse.redirect(new URL(`${origin}/auth/auth-code-error`));
}

