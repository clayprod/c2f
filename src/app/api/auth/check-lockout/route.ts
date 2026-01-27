import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function getClientIP(request: NextRequest): string | null {
  // Try various headers that might contain the real IP
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
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const ipAddress = getClientIP(request);

    // Contar tentativas falhadas nos últimos 15 minutos
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: failedAttempts, error } = await admin
      .from('login_attempts')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('success', false)
      .gte('attempted_at', fifteenMinutesAgo)
      .order('attempted_at', { ascending: false });

    if (error) {
      console.error('Erro ao verificar tentativas de login:', error);
      // Em caso de erro, permitir login (fail open)
      return NextResponse.json({
        locked: false,
        attemptsRemaining: 3,
        requiresCaptcha: false,
      });
    }

    const failedCount = failedAttempts?.length || 0;
    const attemptsRemaining = Math.max(0, 3 - failedCount);
    const locked = failedCount >= 3;
    const requiresCaptcha = failedCount >= 3;

    return NextResponse.json({
      locked,
      attemptsRemaining,
      requiresCaptcha,
      failedAttempts: failedCount,
    });
  } catch (error: any) {
    console.error('Erro ao verificar bloqueio:', error);
    // Fail open - permitir login em caso de erro
    return NextResponse.json({
      locked: false,
      attemptsRemaining: 3,
      requiresCaptcha: false,
    });
  }
}





