/**
 * WhatsApp Status API (User)
 *
 * GET: Get WhatsApp integration status for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerificationStatus, formatPhoneNumber } from '@/services/whatsapp/verification';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { isWhatsAppAvailable, getEvolutionClient } from '@/services/evolution/client';

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

export async function GET(request: NextRequest) {
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

  try {
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
    const verification = await getVerificationStatus(userId);

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
