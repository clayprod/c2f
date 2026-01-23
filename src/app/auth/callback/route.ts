import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Verificar se o perfil está completo
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('city, state, monthly_income_cents')
          .eq('id', user.id)
          .single();

        // Verificar se perfil está incompleto (campos obrigatórios faltando)
        const isProfileIncomplete = !profile || 
          !profile.city || 
          !profile.state || 
          !profile.monthly_income_cents;

        // Verificar se o usuário fez login via OAuth (Google)
        // As identidades estão disponíveis no objeto user após exchangeCodeForSession
        const identities = user.identities || [];
        const isOAuthUser = identities.some((identity: any) => identity.provider === 'google');

        // Se é usuário OAuth e perfil incompleto, redirecionar para completar perfil
        if (isOAuthUser && isProfileIncomplete) {
          const forwardedHost = request.headers.get('x-forwarded-host');
          const isLocalEnv = process.env.NODE_ENV === 'development';
          
          if (isLocalEnv) {
            return NextResponse.redirect(`${origin}/app/complete-profile`);
          } else if (forwardedHost) {
            return NextResponse.redirect(`https://${forwardedHost}/app/complete-profile`);
          } else {
            return NextResponse.redirect(`${origin}/app/complete-profile`);
          }
        }
      }

      // Redirecionar normalmente
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Retornar para página de erro se algo der errado
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

