import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings, getAllPlanFeatures, getPlanDisplayConfig } from '@/services/admin/globalSettings';
import { getStripeClient } from '@/services/stripe/client';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidate every 5 minutes

// Cache in-memory (will be cleared on server restart or manual invalidation)
let cachedPricing: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface PlanFeature {
  id: string;
  text: string;
  enabled: boolean;
}

interface PlanData {
  id: 'free' | 'pro' | 'premium';
  name: string;
  price: number | null;
  priceFormatted: string;
  period: string;
  description: string;
  cta: string;
  popular: boolean;
  stripePriceId?: string | null;
  features: PlanFeature[];
}

/**
 * Format price in BRL
 */
function formatPrice(cents: number | null): string {
  if (cents === null) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Fetch pricing data from Stripe and global settings
 */
async function fetchPricingData(): Promise<PlanData[]> {
  const settings = await getGlobalSettings();
  const allFeatures = await getAllPlanFeatures();
  const displayConfig = await getPlanDisplayConfig();

  const plans: PlanData[] = [];

  // Free Plan
  const freeConfig = displayConfig.free || {};
  const freeFeatures: PlanFeature[] = Object.entries(allFeatures.free)
    .filter(([_, feature]) => feature.enabled)
    .map(([id, feature]) => ({
      id,
      text: feature.text,
      enabled: true,
    }));

  plans.push({
    id: 'free',
    name: freeConfig.name || 'Free',
    price: null,
    priceFormatted: freeConfig.priceFormatted || 'Grátis',
    period: freeConfig.period || 'para sempre',
    description: freeConfig.description || 'Comece a organizar suas finanças',
    cta: freeConfig.cta || 'Começar agora',
    popular: freeConfig.popular || false,
    features: freeFeatures,
  });

  // Pro Plan
  const proPriceId = settings.stripe_price_id_pro;
  let proPrice: number | null = null;
  let proStripePriceId: string | null = null;

  if (proPriceId) {
    try {
      const stripe = getStripeClient();
      const price = await stripe.prices.retrieve(proPriceId);
      
      if (price.active && price.unit_amount) {
        proPrice = price.unit_amount;
        proStripePriceId = price.id;
      }
    } catch (error) {
      console.error('[Pricing API] Error fetching Pro price from Stripe:', error);
      // Fallback to default if Stripe fails
      proPrice = 2900; // R$29 default
    }
  } else {
    // Fallback if not configured
    proPrice = 2900;
  }

  const proConfig = displayConfig.pro || {};
  const proFeatures: PlanFeature[] = Object.entries(allFeatures.pro)
    .filter(([_, feature]) => feature.enabled)
    .map(([id, feature]) => ({
      id,
      text: feature.text,
      enabled: true,
    }));

  plans.push({
    id: 'pro',
    name: proConfig.name || 'Pro',
    price: proPrice,
    priceFormatted: formatPrice(proPrice),
    period: proConfig.period || '/mês',
    description: proConfig.description || 'O poder da IA para suas finanças',
    cta: proConfig.cta || 'Assinar Pro',
    popular: proConfig.popular !== undefined ? proConfig.popular : true,
    stripePriceId: proStripePriceId || proPriceId || null,
    features: proFeatures,
  });

  // Premium Plan
  const premiumPriceId = settings.stripe_price_id_business;
  let premiumPrice: number | null = null;
  let premiumStripePriceId: string | null = null;

  if (premiumPriceId) {
    try {
      const stripe = getStripeClient();
      const price = await stripe.prices.retrieve(premiumPriceId);
      
      if (price.active && price.unit_amount) {
        premiumPrice = price.unit_amount;
        premiumStripePriceId = price.id;
      }
    } catch (error) {
      console.error('[Pricing API] Error fetching Premium price from Stripe:', error);
      // Fallback to default if Stripe fails
      premiumPrice = 7900; // R$79 default
    }
  } else {
    // Fallback if not configured
    premiumPrice = 7900;
  }

  const premiumConfig = displayConfig.premium || {};
  const premiumFeatures: PlanFeature[] = Object.entries(allFeatures.premium)
    .filter(([_, feature]) => feature.enabled)
    .map(([id, feature]) => ({
      id,
      text: feature.text,
      enabled: true,
    }));

  plans.push({
    id: 'premium',
    name: premiumConfig.name || 'Premium',
    price: premiumPrice,
    priceFormatted: formatPrice(premiumPrice),
    period: premiumConfig.period || '/mês',
    description: premiumConfig.description || 'Análise avançada e IA ilimitada',
    cta: premiumConfig.cta || 'Assinar Premium',
    popular: premiumConfig.popular || false,
    stripePriceId: premiumStripePriceId || premiumPriceId || null,
    features: premiumFeatures,
  });

  return plans;
}

export async function GET(request: NextRequest) {
  try {
    // Check cache
    const now = Date.now();
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';
    
    if (!forceRefresh && cachedPricing && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        plans: cachedPricing,
        cached: true,
      });
    }

    const plans = await fetchPricingData();

    // Update cache
    cachedPricing = plans;
    cacheTimestamp = now;

    return NextResponse.json({
      plans,
      cached: false,
    });
  } catch (error: any) {
    console.error('[Pricing API] Error:', error);
    
    // Return fallback data if everything fails
    return NextResponse.json({
      plans: [
        {
          id: 'free',
          name: 'Free',
          price: null,
          priceFormatted: 'Grátis',
          period: 'para sempre',
          description: 'Comece a organizar suas finanças',
          cta: 'Começar agora',
          popular: false,
          features: [
            { id: 'transactions_limit', text: 'Até 100 transações/mês', enabled: true },
            { id: 'csv_import', text: 'Importação CSV', enabled: true },
          ],
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 2900,
          priceFormatted: 'R$29',
          period: '/mês',
          description: 'O poder da IA para suas finanças',
          cta: 'Assinar Pro',
          popular: true,
          features: [
            { id: 'transactions_unlimited', text: 'Transações ilimitadas', enabled: true },
            { id: 'ai_advisor', text: 'AI Advisor (10 consultas/mês)', enabled: true },
            { id: 'ofx_import', text: 'Importação OFX', enabled: true },
          ],
        },
        {
          id: 'premium',
          name: 'Premium',
          price: 7900,
          priceFormatted: 'R$79',
          period: '/mês',
          description: 'Análise avançada e IA ilimitada',
          cta: 'Assinar Premium',
          popular: false,
          features: [
            { id: 'transactions_unlimited', text: 'Transações ilimitadas', enabled: true },
            { id: 'ai_advisor', text: 'AI Advisor (100 consultas/mês)', enabled: true },
            { id: 'pluggy_integration', text: 'Integração Bancária', enabled: true },
          ],
        },
      ],
      error: 'Using fallback data',
    });
  }
}

/**
 * Clear cache endpoint (can be called by admin to invalidate cache)
 * Also called automatically when plan features are updated
 */
export async function POST(request: NextRequest) {
  try {
    // Allow clearing cache without auth for internal calls
    // In production, you might want to add admin auth
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_CACHE_CLEAR_TOKEN;
    
    // If token is set, require it; otherwise allow (for internal calls)
    if (expectedToken) {
      if (authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    cachedPricing = null;
    cacheTimestamp = 0;

    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
