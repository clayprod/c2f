/**
 * WhatsApp Resend API (User)
 *
 * POST: Resend verification code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { sendVerificationCode, getVerificationStatus } from '@/services/whatsapp/verification';
import { getGlobalSettings, getPlanFeatures } from '@/services/admin/globalSettings';
import { getUserPlanAdmin } from '@/services/stripe/subscription';

async function checkWhatsAppAccess(userId: string): Promise<{ allowed: boolean; plan: string }> {
  const userPlan = await getUserPlanAdmin(userId);
  const plan = userPlan.plan;

  // Check if WhatsApp is enabled for this plan from settings
  const planFeatures = await getPlanFeatures(plan);
  
  // Default: WhatsApp is enabled for Pro and Premium plans
  // Only check settings if explicitly configured
  let whatsappEnabled: boolean;
  if (planFeatures?.integrations?.enabled !== undefined) {
    whatsappEnabled = planFeatures.integrations.enabled;
  } else if (planFeatures?.whatsapp_integration?.enabled !== undefined) {
    whatsappEnabled = planFeatures.whatsapp_integration.enabled;
  } else {
    whatsappEnabled = plan === 'pro' || plan === 'premium';
  }

  return { allowed: whatsappEnabled, plan };
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
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);

    // Check if user's plan has WhatsApp access
    const { allowed, plan } = await checkWhatsAppAccess(ownerId);
    if (!allowed) {
      return NextResponse.json({
        error: 'A integração WhatsApp não está disponível no seu plano atual',
        requiresUpgrade: true,
        currentPlan: plan,
      }, { status: 403 });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(ownerId);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: `Aguarde ${rateLimit.waitSeconds} segundos para reenviar o código`,
      }, { status: 429 });
    }

    const settings = await getGlobalSettings();

    // Check if WhatsApp is enabled
    if (!settings.whatsapp_enabled) {
      return NextResponse.json({
        error: 'Integração WhatsApp não está disponível',
      }, { status: 400 });
    }

    // Get existing verification to resend
    const verification = await getVerificationStatus(ownerId);

    if (!verification.phoneNumber) {
      return NextResponse.json({
        error: 'Nenhum número cadastrado para verificação',
      }, { status: 400 });
    }

    if (verification.status === 'verified') {
      return NextResponse.json({
        error: 'Número já está verificado',
      }, { status: 400 });
    }

    // Resend verification code
    const result = await sendVerificationCode(ownerId, verification.phoneNumber);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Erro ao reenviar código',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Código reenviado com sucesso',
    });
  } catch (error: any) {
    console.error('[WhatsApp Resend] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao reenviar código',
    }, { status: 500 });
  }
}
