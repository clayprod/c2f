import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/app';

  // Retornar JSON para debugar
  return NextResponse.json({
    origin,
    code: code ? 'present' : 'missing',
    next,
    env: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    headers: {
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
      'host': request.headers.get('host'),
    }
  });
}