import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createCheckoutSession } from '@/services/stripe/subscription';
import { PLAN_PRICE_IDS } from '@/services/stripe/client';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
});

export async function POST(request: NextRequest) {
  try {
    console.log('[Billing] Starting checkout session...');

    const userId = await getUserId();
    console.log('[Billing] User ID:', userId ? 'found' : 'not found');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = checkoutSchema.parse(body);
    console.log('[Billing] Plan requested:', validated.plan);

    const priceId = validated.plan === 'pro' ? PLAN_PRICE_IDS.PRO : PLAN_PRICE_IDS.BUSINESS;
    console.log('[Billing] Price ID:', priceId || 'NOT CONFIGURED');
    console.log('[Billing] PLAN_PRICE_IDS:', JSON.stringify(PLAN_PRICE_IDS));

    if (!priceId) {
      console.error(`[Billing] Price ID not configured for plan: ${validated.plan}. Set STRIPE_PRICE_ID_${validated.plan.toUpperCase()} in environment variables.`);
      return NextResponse.json({
        error: `Plano ${validated.plan} ainda nao esta configurado. Entre em contato com o suporte.`
      }, { status: 500 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const sessionUrl = await createCheckoutSession(
      userId,
      priceId,
      `${origin}/app?checkout=success`,
      `${origin}/pricing?checkout=cancelled`
    );

    return NextResponse.json({ url: sessionUrl });
  } catch (error: any) {
    console.error('[Billing] Checkout error:', error);
    console.error('[Billing] Error message:', error?.message);
    console.error('[Billing] Error stack:', error?.stack);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    // Stripe specific errors
    if (error?.type?.startsWith('Stripe')) {
      console.error('[Billing] Stripe error type:', error.type);
      console.error('[Billing] Stripe error code:', error.code);
      return NextResponse.json(
        { error: `Erro no Stripe: ${error.message}` },
        { status: 500 }
      );
    }

    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

