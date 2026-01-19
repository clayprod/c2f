/**
 * WhatsApp Register API (User)
 *
 * POST: Register a phone number for verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendVerificationCode, normalizePhoneNumber } from '@/services/whatsapp/verification';
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
  if (!checkRateLimit(userId)) {
    return NextResponse.json({
      error: 'Limite de tentativas excedido. Tente novamente em 1 hora.',
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

    const body = await request.json();
    const { phone_number } = body;

    if (!phone_number) {
      return NextResponse.json({
        error: 'Numero de telefone obrigatorio',
      }, { status: 400 });
    }

    // Validate phone number format
    const normalized = normalizePhoneNumber(phone_number);
    if (normalized.length < 10 || normalized.length > 15) {
      return NextResponse.json({
        error: 'Numero de telefone invalido',
      }, { status: 400 });
    }

    // Send verification code
    const result = await sendVerificationCode(userId, phone_number);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Erro ao enviar codigo de verificacao',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Codigo de verificacao enviado para seu WhatsApp',
    });
  } catch (error: any) {
    console.error('[WhatsApp Register] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao registrar numero',
    }, { status: 500 });
  }
}
