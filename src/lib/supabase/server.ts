import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: false, // Supabase precisa acessar dados no client-side
              });
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}


/**
 * Create Supabase client from NextRequest (for Route Handlers)
 * This is the recommended way to create a Supabase client in API routes
 */
export function createClientFromRequest(request: NextRequest) {
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
            httpOnly: false, // Supabase precisa acessar dados no client-side
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

  return { supabase, response };
}
