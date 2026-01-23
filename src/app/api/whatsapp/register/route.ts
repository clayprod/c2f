/**
 * WhatsApp Register API (User)
 *
 * POST: Register a phone number for verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { sendVerificationCode, normalizePhoneNumber } from '@/services/whatsapp/verification';
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

// Simple rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(userId);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 }); // 1 hour
    return true;
  }

  if (limit.count >= 3) {
    return false;
  }

  limit.count++;
  return true;
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
    if (!checkRateLimit(ownerId)) {
      return NextResponse.json({
        error: 'Limite de tentativas excedido. Tente novamente em 1 hora.',
      }, { status: 429 });
    }

    const settings = await getGlobalSettings();

    // Check if WhatsApp is enabled
    if (!settings.whatsapp_enabled) {
      return NextResponse.json({
        error: 'Integração WhatsApp não está disponível',
      }, { status: 400 });
    }

    const body = await request.json();
    const { phone_number } = body;

    if (!phone_number) {
      return NextResponse.json({
        error: 'Número de telefone obrigatório',
      }, { status: 400 });
    }

    // Validate phone number format
    const normalized = normalizePhoneNumber(phone_number);
    if (normalized.length < 10 || normalized.length > 15) {
      return NextResponse.json({
        error: 'Número de telefone inválido',
      }, { status: 400 });
    }

    // Send verification code
    const result = await sendVerificationCode(ownerId, phone_number);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Erro ao enviar código de verificação',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Código de verificação enviado para seu WhatsApp',
    });
  } catch (error: any) {
    console.error('[WhatsApp Register] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao registrar número',
    }, { status: 500 });
  }
}
