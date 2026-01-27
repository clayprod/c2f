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
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false, // Supabase precisa acessar alguns dados no client-side
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

  // Permitir que o callback do OAuth seja processado sem interferência
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    // Não fazer verificações de autenticação no callback
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
