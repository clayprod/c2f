import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token é obrigatório' },
        { status: 400 }
      );
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      // Se não houver chave secreta configurada, aceitar token (modo desenvolvimento)
      console.warn('TURNSTILE_SECRET_KEY não configurada, aceitando token sem validação');
      return NextResponse.json({ success: true });
    }

    // Verificar token com Cloudflare
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Token inválido', errors: data['error-codes'] },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Erro ao verificar Turnstile:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar token' },
      { status: 500 }
    );
  }
}



