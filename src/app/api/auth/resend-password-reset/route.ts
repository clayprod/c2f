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

    // IMPORTANTE: resetPasswordForEmail() sempre gera um NOVO token válido quando chamado
    // O token anterior (se existir) é automaticamente invalidado
    // Cada chamada cria um novo token com validade padrão configurada no Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

