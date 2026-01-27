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
  // Forçar refresh das configurações globais para pegar os price_ids mais recentes
  const settings = await getGlobalSettings(true); // forceRefresh = true
  console.log('[Pricing API] Global settings - stripe_price_id_pro:', settings.stripe_price_id_pro);
  console.log('[Pricing API] Global settings - stripe_price_id_business:', settings.stripe_price_id_business);
  
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

  // Pro Plan - Buscar price ativo mais recente do Stripe
  const proPriceId = settings.stripe_price_id_pro;
  let proPrice: number | null = null;
  let proStripePriceId: string | null = null;

  try {
    // Verificar se Stripe está configurado
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripeClient();
      
      // Primeiro, tentar usar o price_id das configurações diretamente
      if (proPriceId) {
        try {
          const configuredPrice = await stripe.prices.retrieve(proPriceId);
          if (configuredPrice.active && configuredPrice.unit_amount) {
            proPrice = configuredPrice.unit_amount;
            proStripePriceId = configuredPrice.id;
          }
        } catch (error: any) {
          console.warn('[Pricing API] Configured Pro price ID not found or inactive:', proPriceId, error?.message);
        }
      }
      
      // Se não encontrou o price configurado ou não está ativo, buscar o price ativo mais recente do produto
      if (!proPrice) {
        try {
          // Buscar produtos que contenham "pro" no nome (case insensitive)
          const products = await stripe.products.list({ limit: 100 });
          const proProduct = products.data.find(p => 
            p.name.toLowerCase().includes('pro') && 
            !p.name.toLowerCase().includes('premium') &&
            !p.name.toLowerCase().includes('business')
          );
          
          if (proProduct) {
            // Buscar prices ativos do produto Pro
            const prices = await stripe.prices.list({
              product: proProduct.id,
              active: true,
              limit: 100,
            });
            
            // Pegar o price ativo mais recente (ordenado por created desc)
            const activePrices = prices.data
              .filter(p => p.active && p.unit_amount)
              .sort((a, b) => (b.created || 0) - (a.created || 0));
            
            if (activePrices.length > 0) {
              proPrice = activePrices[0].unit_amount;
              proStripePriceId = activePrices[0].id;
            }
          }
        } catch (error: any) {
          console.warn('[Pricing API] Error searching for Pro product:', error?.message);
        }
      }
    } else {
      console.warn('[Pricing API] STRIPE_SECRET_KEY not configured');
    }
  } catch (error: any) {
    console.error('[Pricing API] Error fetching Pro price from Stripe:', error?.message || error);
  }
  
  // Fallback final se tudo falhar
  if (!proPrice) {
    proPrice = 2900; // R$29 default
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

  // Premium Plan - Buscar price ativo mais recente do Stripe
  const premiumPriceId = settings.stripe_price_id_business;
  let premiumPrice: number | null = null;
  let premiumStripePriceId: string | null = null;

  try {
    // Verificar se Stripe está configurado
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripeClient();
      
      // Primeiro, tentar usar o price_id das configurações diretamente
      if (premiumPriceId) {
        try {
          const configuredPrice = await stripe.prices.retrieve(premiumPriceId);
          if (configuredPrice.active && configuredPrice.unit_amount) {
            premiumPrice = configuredPrice.unit_amount;
            premiumStripePriceId = configuredPrice.id;
          }
        } catch (error: any) {
          console.warn('[Pricing API] Configured Premium price ID not found or inactive:', premiumPriceId, error?.message);
        }
      }
      
      // Se não encontrou o price configurado ou não está ativo, buscar o price ativo mais recente do produto
      if (!premiumPrice) {
        try {
          // Buscar produtos que contenham "premium" ou "business" no nome (case insensitive)
          const products = await stripe.products.list({ limit: 100 });
          const premiumProduct = products.data.find(p => 
            p.name.toLowerCase().includes('premium') || 
            p.name.toLowerCase().includes('business')
          );
          
          if (premiumProduct) {
            // Buscar prices ativos do produto Premium/Business
            const prices = await stripe.prices.list({
              product: premiumProduct.id,
              active: true,
              limit: 100,
            });
            
            // Pegar o price ativo mais recente (ordenado por created desc)
            const activePrices = prices.data
              .filter(p => p.active && p.unit_amount)
              .sort((a, b) => (b.created || 0) - (a.created || 0));
            
            if (activePrices.length > 0) {
              premiumPrice = activePrices[0].unit_amount;
              premiumStripePriceId = activePrices[0].id;
            }
          }
        } catch (error: any) {
          console.warn('[Pricing API] Error searching for Premium product:', error?.message);
        }
      }
    } else {
      console.warn('[Pricing API] STRIPE_SECRET_KEY not configured');
    }
  } catch (error: any) {
    console.error('[Pricing API] Error fetching Premium price from Stripe:', error?.message || error);
  }
  
  // Fallback final se tudo falhar
  if (!premiumPrice) {
    premiumPrice = 7900; // R$79 default
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
    const skipCache = request.nextUrl.searchParams.get('skipCache') === 'true';

    // Se skipCache, sempre buscar dados frescos (útil após atualizar preços no admin)
    if (!skipCache) {
      const cachedPricing = getPricingCache(now);
      if (!forceRefresh && cachedPricing) {
        console.log('[Pricing API] Returning cached pricing data');
        return NextResponse.json({
          plans: cachedPricing,
          cached: true,
        });
      }
    } else {
      console.log('[Pricing API] Skipping cache, fetching fresh data');
    }

    const plans = await fetchPricingData();

    // Log para debug detalhado
    console.log('[Pricing API] Fetched plans:', plans.map(p => ({ 
      id: p.id, 
      price: p.price, 
      priceFormatted: p.priceFormatted,
      stripePriceId: p.stripePriceId 
    })));
    console.log('[Pricing API] Pro plan price:', plans.find(p => p.id === 'pro')?.price, 'cents =', plans.find(p => p.id === 'pro')?.priceFormatted);
    console.log('[Pricing API] Premium plan price:', plans.find(p => p.id === 'premium')?.price, 'cents =', plans.find(p => p.id === 'premium')?.priceFormatted);

    // Update cache
    setPricingCache(plans, now);

    return NextResponse.json({
      plans,
      cached: false,
    });
  } catch (error: any) {
    console.error('[Pricing API] Error:', error?.message || error);
    
    // Tentar retornar dados do cache mesmo se houver erro
    const cachedPricing = getPricingCache(Date.now());
    if (cachedPricing) {
      console.log('[Pricing API] Returning cached data due to error');
      return NextResponse.json({
        plans: cachedPricing,
        cached: true,
        error: 'Using cached data due to error',
      });
    }
    
    // Return fallback data if everything fails
    console.log('[Pricing API] Returning fallback data');
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
