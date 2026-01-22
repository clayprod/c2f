/**
 * WhatsApp Status API (User)
 *
 * GET: Get WhatsApp integration status for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { getVerificationStatus, formatPhoneNumber } from '@/services/whatsapp/verification';
import { getGlobalSettings, getPlanFeatures } from '@/services/admin/globalSettings';
import { getUserPlanAdmin } from '@/services/stripe/subscription';
import { isWhatsAppAvailable, getEvolutionClient } from '@/services/evolution/client';

async function checkWhatsAppAccess(userId: string): Promise<{ allowed: boolean; plan: string }> {
  const userPlan = await getUserPlanAdmin(userId);
  const plan = userPlan.plan;

  // Check if WhatsApp is enabled for this plan from settings
  const planFeatures = await getPlanFeatures(plan);
  
  // Default: WhatsApp is enabled for Pro and Premium plans
  // Only check settings if explicitly configured
  let whatsappEnabled: boolean;
  if (planFeatures?.whatsapp_integration?.enabled !== undefined) {
    // Use explicit configuration if set
    whatsappEnabled = planFeatures.whatsapp_integration.enabled;
  } else {
    // Default: enabled for Pro and Premium, disabled for Free
    whatsappEnabled = plan === 'pro' || plan === 'premium';
  }

  return { allowed: whatsappEnabled, plan };
}

export async function GET(request: NextRequest) {
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

    const settings = await getGlobalSettings();

    // Check if WhatsApp is enabled globally
    if (!settings.whatsapp_enabled) {
      return NextResponse.json({
        enabled: false,
        configured: false,
        message: 'Integracao WhatsApp nao esta disponivel no momento',
      });
    }

    // Check if Evolution API is connected
    const isAvailable = await isWhatsAppAvailable();
    if (!isAvailable) {
      return NextResponse.json({
        enabled: true,
        configured: false,
        message: 'Servico WhatsApp temporariamente indisponivel',
      });
    }

    // Get instance phone number
    let instancePhoneNumber: string | null = null;
    try {
      const client = await getEvolutionClient();
      if (client) {
        const info = await client.getInstanceInfo();
        instancePhoneNumber = info.number || null;
      }
    } catch {
      // Ignore error getting instance info
    }

    // Get user verification status
    const verification = await getVerificationStatus(ownerId);

    return NextResponse.json({
      enabled: true,
      configured: true,
      phoneNumber: verification.phoneNumber ? formatPhoneNumber(verification.phoneNumber) : null,
      phoneNumberRaw: verification.phoneNumber,
      status: verification.status,
      verifiedAt: verification.verifiedAt,
      verified: verification.status === 'verified',
      instancePhoneNumber: instancePhoneNumber ? formatPhoneNumber(instancePhoneNumber) : null,
    });
  } catch (error) {
    console.error('[WhatsApp Status] Error:', error);
    return NextResponse.json({ error: 'Erro ao obter status' }, { status: 500 });
  }
}
