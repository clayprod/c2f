import Link from 'next/link';

interface PlanFeature {
  id: string;
  text: string;
  enabled: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number | null;
  priceFormatted: string;
  originalPrice?: number | null;
  originalPriceFormatted?: string | null;
  period: string;
  description: string;
  cta: string;
  popular: boolean;
  features: PlanFeature[];
}

async function getPricingData(): Promise<Plan[]> {
  try {
    // For server components, we can import the service directly
    // But to keep it simple and avoid circular dependencies, we'll use fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';
    
    const res = await fetch(`${baseUrl}/api/public/pricing?refresh=true`, {
      next: { revalidate: 0 }, // Sempre buscar dados frescos
      cache: 'no-store', // Não usar cache do Next.js
    });
    
    if (!res.ok) {
      console.error('[Pricing] API returned error:', res.status, res.statusText);
      throw new Error(`Failed to fetch pricing: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('[Pricing] Received plans:', data.plans?.map((p: Plan) => ({ id: p.id, priceFormatted: p.priceFormatted })));
    
    if (data.plans && data.plans.length > 0) {
      return data.plans;
    }
    
    throw new Error('No plans returned from API');
  } catch (error) {
    console.error('[Pricing] Error fetching pricing data:', error);
    // Return fallback data
    return [
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
    ];
  }
}

const Pricing = async () => {
  const plans = await getPricingData();
  return (
    <section id="pricing" className="section-padding pt-10 md:pt-12">
      <div className="container-custom">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-tag'></i>
            Preços
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Planos para cada <span className="gradient-text">necessidade</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comece grátis e escale conforme você cresce
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-6 md:p-8 relative flex h-full flex-col ${plan.popular ? 'border-primary/50 md:scale-105' : ''
                }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge-pill text-xs bg-primary text-primary-foreground border-primary">
                    Mais popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-display font-semibold text-xl mb-2">{plan.name}</h3>
                {plan.originalPriceFormatted && (
                  <div className="text-muted-foreground text-sm mb-1">
                    <span className="line-through">de {plan.originalPriceFormatted}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-1 mb-2">
                  {plan.originalPriceFormatted && (
                    <span className="text-muted-foreground text-sm mr-1">por</span>
                  )}
                  <span className="font-display text-4xl font-bold">{plan.priceFormatted}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.id} className="flex items-start gap-2 text-sm">
                    <i className='bx bx-check text-primary text-lg flex-shrink-0'></i>
                    <span className="text-foreground/80">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-auto w-full text-center ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            * Open Finance estará disponível em breve
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
