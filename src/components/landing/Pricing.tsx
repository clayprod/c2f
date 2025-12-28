import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    price: 'Grátis',
    period: 'para sempre',
    description: 'Para começar a organizar suas finanças',
    features: [
      'Até 100 transações/mês',
      'Dashboard básico',
      'Importação CSV',
      '3 consultas ao Advisor/mês',
      'Suporte por email',
    ],
    cta: 'Começar grátis',
    popular: false,
  },
  {
    name: 'Pro',
    price: 'R$29',
    period: '/mês',
    description: 'Para quem quer controle total',
    features: [
      'Transações ilimitadas',
      'Dashboard avançado',
      'Importação CSV + OFX',
      'Advisor ilimitado',
      'Orçamentos e metas',
      'Relatórios detalhados',
      'Suporte prioritário',
    ],
    cta: 'Assinar Pro',
    popular: true,
  },
  {
    name: 'Business',
    price: 'R$79',
    period: '/mês',
    description: 'Para equipes e empresas',
    features: [
      'Tudo do Pro',
      'Múltiplos usuários',
      'Integração bancária (Pluggy)',
      'Auditoria e logs',
      'API de integração',
      'Onboarding dedicado',
      'SLA garantido',
    ],
    cta: 'Falar com vendas',
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="section-padding">
      <div className="container-custom">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-purchase-tag'></i>
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
              className={`glass-card p-6 md:p-8 relative ${
                plan.popular ? 'border-primary/50 md:scale-105' : ''
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
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <i className='bx bx-check text-primary text-lg flex-shrink-0'></i>
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/signup"
                className={`w-full text-center ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
