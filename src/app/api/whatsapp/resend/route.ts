/**
 * WhatsApp Resend API (User)
 *
 * POST: Resend verification code
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendVerificationCode, getVerificationStatus } from '@/services/whatsapp/verification';
import { getGlobalSettings } from '@/services/admin/globalSettings';

async function getUserId(request: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

async function requirePremium(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('billing_subscriptions')
    .select('plan_id, status')
    .eq('user_id', userId)
    .single();

  return data?.plan_id === 'premium' && data?.status === 'active';
}

// Rate limiting: 1 per minute, 5 per hour
const minuteRateLimitMap = new Map<string, number>();
const hourRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();

  // Check minute limit
  const lastMinute = minuteRateLimitMap.get(userId);
  if (lastMinute && now - lastMinute < 60 * 1000) {
    const waitSeconds = Math.ceil((60 * 1000 - (now - lastMinute)) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Check hour limit
  const hourLimit = hourRateLimitMap.get(userId);
  if (hourLimit && now < hourLimit.resetAt && hourLimit.count >= 5) {
    const waitSeconds = Math.ceil((hourLimit.resetAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Update limits
  minuteRateLimitMap.set(userId, now);

  if (!hourLimit || now >= hourLimit.resetAt) {
    hourRateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    hourLimit.count++;
  }

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check premium plan
  const isPremium = await requirePremium(userId);
  if (!isPremium) {
    return NextResponse.json({
      error: 'Esta funcionalidade requer o plano Premium',
      requiresUpgrade: true,
    }, { status: 403 });
  }

  // Check rate limit
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      error: `Aguarde ${rateLimit.waitSeconds} segundos para reenviar o codigo`,
    }, { status: 429 });
  }

  try {
    const settings = await getGlobalSettings();

    // Check if WhatsApp is enabled
    if (!settings.whatsapp_enabled) {
      return NextResponse.json({
        error: 'Integracao WhatsApp nao esta disponivel',
      }, { status: 400 });
    }

    // Get existing verification to resend
    const verification = await getVerificationStatus(userId);

    if (!verification.phoneNumber) {
      return NextResponse.json({
        error: 'Nenhum numero cadastrado para verificacao',
      }, { status: 400 });
    }

    if (verification.status === 'verified') {
      return NextResponse.json({
        error: 'Numero ja esta verificado',
      }, { status: 400 });
    }

    // Resend verification code
    const result = await sendVerificationCode(userId, verification.phoneNumber);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Erro ao reenviar codigo',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Codigo reenviado com sucesso',
    });
  } catch (error: any) {
    console.error('[WhatsApp Resend] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao reenviar codigo',
    }, { status: 500 });
  }
}
