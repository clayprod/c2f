/**
 * WhatsApp Verify API (User)
 *
 * POST: Verify the code sent to WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { validateVerificationCode } from '@/services/whatsapp/verification';
import { getPlanFeatures } from '@/services/admin/globalSettings';
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

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(userId);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 }); // 1 hour
    return true;
  }

  if (limit.count >= 5) {
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

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({
        error: 'Código de verificação obrigatório',
      }, { status: 400 });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({
        error: 'Código deve ter 6 dígitos',
      }, { status: 400 });
    }

    // Validate verification code
    const result = await validateVerificationCode(ownerId, code);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Código inválido',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Número verificado com sucesso!',
    });
  } catch (error: any) {
    console.error('[WhatsApp Verify] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao verificar código',
    }, { status: 500 });
  }
}
