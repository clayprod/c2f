import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings, getAllPlanFeatures, getPlanDisplayConfig } from '@/services/admin/globalSettings';
import { buildPlanFeatureList, buildPlanFeatureListWithInheritance } from '@/lib/planFeatures';
import { getStripeClient } from '@/services/stripe/client';
import { clearPricingCache, getPricingCache, setPricingCache } from '@/services/pricing/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidate every 5 minutes

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
  originalPrice?: number | null;
  originalPriceFormatted?: string | null;
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
  const fallbackFeatureSets = {
    free: [
      { id: 'dashboard', text: 'Visão geral das finanças', enabled: true },
      { id: 'transactions', text: 'Até 100 lançamentos/mês', enabled: true },
      { id: 'accounts', text: 'Contas bancárias ilimitadas', enabled: true },
      { id: 'credit_cards', text: 'Controle de cartões de crédito', enabled: true },
      { id: 'categories', text: 'Categorização personalizada', enabled: true },
    ],
    pro: [
      { id: 'all_free', text: 'Tudo do plano Free', enabled: true },
      { id: 'transactions', text: 'Lançamentos ilimitados', enabled: true },
      { id: 'budgets', text: 'Orçamentos mensais por categoria', enabled: true },
      { id: 'debts', text: 'Controle e negociação de dívidas', enabled: true },
      { id: 'investments', text: 'Acompanhamento de investimentos', enabled: true },
      { id: 'goals', text: 'Metas financeiras com projeções', enabled: true },
      { id: 'ai_advisor', text: 'AI Advisor (10 consultas/mês)', enabled: true },
    ],
    premium: [
      { id: 'all_pro', text: 'Tudo do plano Pro', enabled: true },
      { id: 'reports', text: 'Relatórios detalhados e exportação', enabled: true },
      { id: 'integrations', text: 'WhatsApp + Open Finance*', enabled: true },
      { id: 'assets', text: 'Gestão de patrimônio e bens', enabled: true },
      { id: 'ai_advisor', text: 'AI Advisor ilimitado', enabled: true },
    ],
  };

  // Free Plan
  const freeConfig = displayConfig.free || {};
  const freeFeaturesList = await buildPlanFeatureList(allFeatures.free);
  const freeFeatures: PlanFeature[] = freeFeaturesList.map((feature) => ({
    id: feature.id,
    text: feature.text,
    enabled: true,
  }));

  plans.push({
    id: 'free',
    name: freeConfig.name || 'Free',
    price: null,
    priceFormatted: freeConfig.priceFormatted || 'Grátis',
    originalPrice: freeConfig.originalPrice || null,
    originalPriceFormatted: freeConfig.originalPrice ? formatPrice(freeConfig.originalPrice) : null,
    period: freeConfig.period || 'para sempre',
    description: freeConfig.description || 'Comece a organizar suas finanças',
    cta: freeConfig.cta || 'Começar agora',
    popular: freeConfig.popular || false,
    features: freeFeatures.length ? freeFeatures : fallbackFeatureSets.free,
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
  const proFeaturesList = await buildPlanFeatureListWithInheritance(
    allFeatures.pro,
    allFeatures.free,
    'Free'
  );
  const proFeatures: PlanFeature[] = proFeaturesList.map((feature) => ({
    id: feature.id,
    text: feature.text,
    enabled: true,
  }));

  plans.push({
    id: 'pro',
    name: proConfig.name || 'Pro',
    price: proPrice,
    priceFormatted: formatPrice(proPrice),
    originalPrice: proConfig.originalPrice || null,
    originalPriceFormatted: proConfig.originalPrice ? formatPrice(proConfig.originalPrice) : null,
    period: proConfig.period || '/mês',
    description: proConfig.description || 'O poder da IA para suas finanças',
    cta: proConfig.cta || 'Assinar Pro',
    popular: proConfig.popular !== undefined ? proConfig.popular : true,
    stripePriceId: proStripePriceId || proPriceId || null,
    features: proFeatures.length ? proFeatures : fallbackFeatureSets.pro,
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
  const premiumFeaturesList = await buildPlanFeatureListWithInheritance(
    allFeatures.premium,
    allFeatures.pro,
    'Pro'
  );
  const premiumFeatures: PlanFeature[] = premiumFeaturesList.map((feature) => ({
    id: feature.id,
    text: feature.text,
    enabled: true,
  }));

  plans.push({
    id: 'premium',
    name: premiumConfig.name || 'Premium',
    price: premiumPrice,
    priceFormatted: formatPrice(premiumPrice),
    originalPrice: premiumConfig.originalPrice || null,
    originalPriceFormatted: premiumConfig.originalPrice ? formatPrice(premiumConfig.originalPrice) : null,
    period: premiumConfig.period || '/mês',
    description: premiumConfig.description || 'Análise avançada e IA ilimitada',
    cta: premiumConfig.cta || 'Assinar Premium',
    popular: premiumConfig.popular || false,
    stripePriceId: premiumStripePriceId || premiumPriceId || null,
    features: premiumFeatures.length ? premiumFeatures : fallbackFeatureSets.premium,
  });

  return plans;
}

export async function GET(request: NextRequest) {
  try {
    // Check cache
    const now = Date.now();
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    const cachedPricing = getPricingCache(now);
    if (!forceRefresh && cachedPricing) {
      return NextResponse.json({
        plans: cachedPricing,
        cached: true,
      });
    }

    const plans = await fetchPricingData();

    // Update cache
    setPricingCache(plans, now);

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
            { id: 'dashboard', text: 'Visão geral das finanças', enabled: true },
            { id: 'transactions', text: 'Até 100 lançamentos/mês', enabled: true },
            { id: 'accounts', text: 'Contas bancárias ilimitadas', enabled: true },
            { id: 'credit_cards', text: 'Controle de cartões de crédito', enabled: true },
            { id: 'categories', text: 'Categorização personalizada', enabled: true },
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
            { id: 'all_free', text: 'Tudo do plano Free', enabled: true },
            { id: 'transactions', text: 'Lançamentos ilimitados', enabled: true },
            { id: 'budgets', text: 'Orçamentos mensais por categoria', enabled: true },
            { id: 'debts', text: 'Controle e negociação de dívidas', enabled: true },
            { id: 'investments', text: 'Acompanhamento de investimentos', enabled: true },
            { id: 'goals', text: 'Metas financeiras com projeções', enabled: true },
            { id: 'ai_advisor', text: 'AI Advisor (10 consultas/mês)', enabled: true },
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
            { id: 'all_pro', text: 'Tudo do plano Pro', enabled: true },
            { id: 'reports', text: 'Relatórios detalhados e exportação', enabled: true },
            { id: 'integrations', text: 'WhatsApp + Open Finance*', enabled: true },
            { id: 'assets', text: 'Gestão de patrimônio e bens', enabled: true },
            { id: 'ai_advisor', text: 'AI Advisor ilimitado', enabled: true },
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

    clearPricingCache();

    return NextResponse.json({ success: true, message: 'Cache cleared' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
