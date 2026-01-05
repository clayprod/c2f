export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const plans = [
  {
    name: 'Free',
    price: 'Grátis',
    period: 'para sempre',
    description: 'Para começar a organizar suas finanças',
    features: [
      { text: 'Até 100 transações/mês', included: true },
      { text: 'Dashboard básico', included: true },
      { text: 'Importação CSV', included: true },
      { text: '3 consultas ao Advisor/mês', included: true },
      { text: 'Suporte por email', included: true },
      { text: 'Importação OFX', included: false },
      { text: 'Orçamentos e metas', included: false },
      { text: 'Relatórios detalhados', included: false },
      { text: 'Integração bancária', included: false },
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
      { text: 'Transações ilimitadas', included: true },
      { text: 'Dashboard avançado', included: true },
      { text: 'Importação CSV + OFX', included: true },
      { text: 'Advisor ilimitado', included: true },
      { text: 'Orçamentos e Projeções', included: true },
      { text: 'Dívidas', included: true },
      { text: 'Investimentos', included: true },
      { text: 'Patrimônio', included: true },
      { text: 'Objetivos', included: true },
      { text: 'Relatórios detalhados', included: true },
      { text: 'Categorias personalizadas', included: true },
      { text: 'Suporte prioritário', included: true },
      { text: 'Integração bancária', included: false },
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
      { text: 'Tudo do Pro', included: true },
      { text: 'Múltiplos usuários (até 5)', included: true },
      { text: 'Integração bancária (Pluggy)', included: true },
      { text: 'Auditoria e logs', included: true },
      { text: 'API de integração', included: true },
      { text: 'Onboarding dedicado', included: true },
      { text: 'SLA garantido', included: true },
      { text: 'Suporte via chat', included: true },
      { text: 'White-label (em breve)', included: false },
    ],
    cta: 'Falar com vendas',
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-32 pb-20">
        <div className="container-custom">
          <div className="text-center mb-16">
            <span className="badge-pill mb-4">
              <i className='bx bx-purchase-tag'></i>
              Preços
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Escolha seu <span className="gradient-text">plano</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Comece grátis e escale conforme suas necessidades. Todos os planos incluem 14 dias de teste.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-20">
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
                    <li key={feature.text} className="flex items-start gap-2 text-sm">
                      <i
                        className={`bx ${feature.included ? 'bx-check text-primary' : 'bx-x text-muted-foreground/50'} text-lg flex-shrink-0`}
                      ></i>
                      <span className={feature.included ? 'text-foreground/80' : 'text-muted-foreground/50'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`w-full text-center block ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-2xl font-bold mb-4">Ainda tem dúvidas?</h2>
            <p className="text-muted-foreground mb-6">
              Confira nossa seção de perguntas frequentes ou entre em contato com nosso suporte.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/#faq" className="btn-secondary">
                <i className='bx bx-help-circle'></i>
                Ver FAQ
              </Link>
              <a href="mailto:suporte@c2finance.com" className="btn-secondary">
                <i className='bx bx-support'></i>
                Falar com suporte
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}





