import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') || '/app';

  // Log para debugging
  console.log('Auth callback initiated:', {
    url: request.url,
    code: code ? 'present' : 'missing',
    next
  });

  // Determinar a base de redirecionamento de forma robusta
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

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
      const cookieStore = cookies();

      // Criar a resposta de redirecionamento primeiro
      const targetPath = (next === '/' || !next) ? '/app' : next;
      const redirectUrl = new URL(targetPath, origin);
      const response = NextResponse.redirect(redirectUrl);

      // Criar o cliente Supabase vinculado a essa resposta para garantir que os cookies sejam definidos nela
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              // Definir no cookieStore para o contexto atual
              cookieStore.set({ name, value, ...options });
              // Definir na resposta para o redirecionamento
              response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
              cookieStore.delete({ name, ...options });
              response.cookies.delete({ name, ...options });
            },
          },
        }
      );

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Exchange error:', exchangeError);
        throw exchangeError;
      }

      console.log('Auth successful, redirecting to:', redirectUrl.toString());
      return response;
    } catch (error: any) {
      console.error('Auth callback exception:', error);
    }
  }

  // Fallback de erro
  return NextResponse.redirect(new URL('/auth/auth-code-error', origin));
}

