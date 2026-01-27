import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/app';

  console.log('Test callback - Origin:', origin);
  console.log('Test callback - Node env:', process.env.NODE_ENV);
  
  // Forçar redirecionamento correto em produção
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(`https://c2finance.com.br${next}`);
  } else {
    const devOrigin = origin.includes('0.0.0.0') ? origin.replace('0.0.0.0', 'localhost') : origin;
    return NextResponse.redirect(`${devOrigin}${next}`);
  }
}