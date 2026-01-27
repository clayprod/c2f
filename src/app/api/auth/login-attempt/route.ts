import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { email, success } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const ipAddress = getClientIP(request);

    // Registrar tentativa
    const { error: insertError } = await admin
      .from('login_attempts')
      .insert({
        email: email.toLowerCase(),
        ip_address: ipAddress,
        success: success === true,
      });

    if (insertError) {
      console.error('Erro ao registrar tentativa de login:', insertError);
    }

    // Se falhou, verificar se precisa bloquear e enviar email de redefinição
    if (!success) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { data: failedAttempts } = await admin
        .from('login_attempts')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('success', false)
        .gte('attempted_at', fifteenMinutesAgo);

      const failedCount = failedAttempts?.length || 0;

      // Se atingiu 3 tentativas falhadas, enviar email de redefinição
      if (failedCount >= 3) {
        try {
          const supabase = await createClient();
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${request.headers.get('origin') || 'http://localhost:3000'}/login?reset=true`,
          });

          if (resetError) {
            console.error('Erro ao enviar email de redefinição:', resetError);
          }
        } catch (resetErr) {
          console.error('Erro ao tentar enviar email de redefinição:', resetErr);
        }
      }

      const attemptsRemaining = Math.max(0, 3 - failedCount);
      const locked = failedCount >= 3;

      return NextResponse.json({
        success: true,
        locked,
        attemptsRemaining,
        requiresCaptcha: locked,
        passwordResetSent: locked,
      });
    }

    // Se sucesso, retornar status normal
    return NextResponse.json({
      success: true,
      locked: false,
      attemptsRemaining: 3,
      requiresCaptcha: false,
    });
  } catch (error: any) {
    console.error('Erro ao registrar tentativa de login:', error);
    return NextResponse.json(
      { error: 'Erro ao processar tentativa de login' },
      { status: 500 }
    );
  }
}





