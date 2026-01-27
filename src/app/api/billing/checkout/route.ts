import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createCheckoutSession } from '@/services/stripe/subscription';
import { PLAN_PRICE_IDS } from '@/services/stripe/client';
import { createErrorResponse } from '@/lib/errors';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getStripeClient } from '@/services/stripe/client';
import { z } from 'zod';

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'premium']),
});

/**
 * Busca o price_id ativo mais recente do Stripe para um plano
 */
async function getActivePriceId(plan: 'pro' | 'premium'): Promise<string | null> {
  try {
    const stripe = getStripeClient();
    const settings = await getGlobalSettings();
    
    const configuredPriceId = plan === 'pro' 
      ? settings.stripe_price_id_pro 
      : settings.stripe_price_id_business;
    
    // Primeiro, tentar usar o price_id das configurações diretamente
    if (configuredPriceId) {
      try {
        const configuredPrice = await stripe.prices.retrieve(configuredPriceId);
        if (configuredPrice.active) {
          return configuredPrice.id;
        }
      } catch (error) {
        console.warn(`[Billing] Configured ${plan} price ID not found or inactive:`, configuredPriceId);
      }
    }
    
    // Se não encontrou o price configurado ou não está ativo, buscar o price ativo mais recente do produto
    const products = await stripe.products.list({ limit: 100 });
    let targetProduct;
    
    if (plan === 'pro') {
      targetProduct = products.data.find(p => 
        p.name.toLowerCase().includes('pro') && 
        !p.name.toLowerCase().includes('premium') &&
        !p.name.toLowerCase().includes('business')
      );
    } else {
      targetProduct = products.data.find(p => 
        p.name.toLowerCase().includes('premium') || 
        p.name.toLowerCase().includes('business')
      );
    }
    
    if (targetProduct) {
      // Buscar prices ativos do produto
      const prices = await stripe.prices.list({
        product: targetProduct.id,
        active: true,
        limit: 100,
      });
      
      // Pegar o price ativo mais recente (ordenado por created desc)
      const activePrices = prices.data
        .filter(p => p.active && p.unit_amount)
        .sort((a, b) => (b.created || 0) - (a.created || 0));
      
      if (activePrices.length > 0) {
        return activePrices[0].id;
      }
    }
    
    // Fallback final: usar variáveis de ambiente
    return plan === 'pro' ? PLAN_PRICE_IDS.PRO : PLAN_PRICE_IDS.PREMIUM;
  } catch (error) {
    console.error(`[Billing] Error fetching active price for ${plan}:`, error);
    // Fallback para variáveis de ambiente
    return plan === 'pro' ? PLAN_PRICE_IDS.PRO : PLAN_PRICE_IDS.PREMIUM;
  }
}

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

    const priceId = await getActivePriceId(validated.plan);
    console.log('[Billing] Price ID:', priceId || 'NOT CONFIGURED');

    if (!priceId) {
      console.error(`[Billing] Price ID not configured for plan: ${validated.plan}`);
      return NextResponse.json({
        error: `Plano ${validated.plan} ainda não está configurado. Entre em contato com o suporte.`
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

