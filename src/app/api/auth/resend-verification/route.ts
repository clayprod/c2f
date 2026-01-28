import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // Validação básica
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);
    
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let redirectUrl = `${origin}/auth/confirm`;
    if (redirectUrl.includes('0.0.0.0')) {
      redirectUrl = redirectUrl.replace('0.0.0.0', 'localhost');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      // Tratar erros específicos do Supabase
      // Rate limit: verificar se erro contém "rate limit" ou código 429
      // IMPORTANTE: resend() sempre gera um NOVO token válido quando bem-sucedido
      // O token anterior é automaticamente invalidado
      throw error;
    }

    // Sucesso: novo token/OTP foi gerado e enviado por email
    // O token anterior (se existir) foi invalidado
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

