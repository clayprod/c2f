/**
 * WhatsApp Verify API (User)
 *
 * POST: Verify the code sent to WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateVerificationCode } from '@/services/whatsapp/verification';

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
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({
        error: 'Codigo de verificacao obrigatorio',
      }, { status: 400 });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({
        error: 'Codigo deve ter 6 digitos',
      }, { status: 400 });
    }

    // Validate verification code
    const result = await validateVerificationCode(userId, code);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Codigo invalido',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Numero verificado com sucesso!',
    });
  } catch (error: any) {
    console.error('[WhatsApp Verify] Error:', error);
    return NextResponse.json({
      error: error.message || 'Erro ao verificar codigo',
    }, { status: 500 });
  }
}
