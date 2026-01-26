import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Usar o parâmetro next da query string, ou padrão para /app
  const next = searchParams.get('next') || '/app';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Verificar se a sessão foi estabelecida corretamente
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Redirecionar para o destino especificado (ou /app por padrão)
        const forwardedHost = request.headers.get('x-forwarded-host');
        const isLocalEnv = process.env.NODE_ENV === 'development';

        let redirectUrl: string;
        if (isLocalEnv) {
          redirectUrl = `${origin}${next}`;
        } else if (forwardedHost) {
          redirectUrl = `https://${forwardedHost}${next}`;
        } else {
          redirectUrl = `${origin}${next}`;
        }

        // Usar NextResponse.redirect com URL absoluta
        return NextResponse.redirect(new URL(redirectUrl));
      }
    }
  }

  // Retornar para página de erro se algo der errado
  return NextResponse.redirect(new URL(`${origin}/auth/auth-code-error`));
}

