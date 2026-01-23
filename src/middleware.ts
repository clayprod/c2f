import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          const cookieOptions = {
            ...options,
            maxAge: options?.maxAge || 60 * 60 * 24 * 30, // 30 dias por padrão
            sameSite: 'lax' as const,
            path: '/',
            httpOnly: false, // Supabase precisa acessar cookies no client-side
          };
          request.cookies.set({
            name,
            value,
            ...cookieOptions,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          });
        },
        remove(name: string, options: any) {
          const cookieOptions = {
            ...options,
            maxAge: 0,
            path: '/',
          };
          request.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rotas protegidas
  const protectedRoutes = ['/app'];
  // Exceções para páginas que podem ser acessadas sem autenticação
  const publicAppRoutes = ['/app/terms-of-service', '/app/privacy-policy'];

  const isPublicAppRoute = publicAppRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  ) && !isPublicAppRoute;

  // Se é rota protegida e não há sessão, redirecionar para login
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Verificar rota admin
  const isAdminRoute = request.nextUrl.pathname.startsWith('/app/admin');
  
  if (isAdminRoute && user) {
    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      // Redirect non-admins to dashboard
      return NextResponse.redirect(new URL('/app', request.url));
    }
  }

  // Se é rota protegida e há sessão, verificar se perfil está completo
  if (isProtectedRoute && user) {
    // Não verificar perfil incompleto na própria página de completar perfil
    if (request.nextUrl.pathname === '/app/complete-profile') {
      return response;
    }

    // Verificar se o usuário fez login via OAuth e tem perfil incompleto
    const { data: profile } = await supabase
      .from('profiles')
      .select('city, state, monthly_income_cents')
      .eq('id', user.id)
      .single();

    const isProfileIncomplete = !profile || 
      !profile.city || 
      !profile.state || 
      !profile.monthly_income_cents;

    // Verificar se é usuário OAuth (Google)
    const identities = user.identities || [];
    const isOAuthUser = identities.some((identity: any) => identity.provider === 'google');

    // Se é usuário OAuth e perfil incompleto, redirecionar para completar perfil
    if (isOAuthUser && isProfileIncomplete) {
      return NextResponse.redirect(new URL('/app/complete-profile', request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

