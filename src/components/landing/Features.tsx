import Image from 'next/image';

const features = [
  {
    icon: 'bx-sparkles',
    title: 'AI Advisor',
    description: 'Insights personalizados e ações sugeridas pela inteligência artificial.',
  },
  {
    icon: 'bxl-whatsapp',
    title: 'WhatsApp',
    description: 'Receba alertas, consulte seu saldo e registre novas transações diretamente pelo WhatsApp.',
  },
  {
    icon: 'openfinance',
    title: 'Open Finance',
    description: 'Conecte seus bancos via Open Finance (em breve).',
    comingSoon: true,
  },
  {
    icon: 'bx-trending-up',
    title: 'Dashboard Inteligente',
    description: 'Visualize receitas, despesas e saldo em tempo real com gráficos interativos.',
  },
  {
    icon: 'bx-folder-open',
    title: 'Importação CSV/OFX',
    description: 'Importe extratos de qualquer banco nos formatos mais comuns.',
  },
  {
    icon: 'bx-calculator',
    title: 'Orçamentos & Projeções',
    description: 'Defina metas de gastos e veja projeções baseadas no seu histórico.',
  },
  {
    icon: 'bx-pie-chart-alt-2',
    title: 'Categorização automática',
    description: 'Organize seus lançamentos com categorias inteligentes e automáticas.',
  },
  {
    icon: 'bx-coin',
    title: 'Rendimentos e juros',
    description: 'Cálculo automático de rendimentos e juros da sua conta.',
  },
  {
    icon: 'bx-credit-card',
    title: 'Cartões de Crédito',
    description: 'Controle suas faturas, limites e vencimentos de todos os seus cartões.',
  },
  {
    icon: 'bx-note',
    title: 'Gestão de Dívidas',
    description: 'Acompanhe suas dívidas, negocie valores e monitore o progresso do pagamento.',
  },
  {
    icon: 'bx-receipt',
    title: 'Recebíveis',
    description: 'Controle tudo que você vai receber e planeje seu fluxo de caixa futuro.',
  },
  {
    icon: 'bx-bar-chart',
    title: 'Investimentos',
    description: 'Acompanhe seus investimentos e veja o rendimento de cada aplicação.',
  },
  {
    icon: 'bx-home-alt',
    title: 'Patrimônio & Ativos',
    description: 'Gerencie seus bens, imóveis e ativos para ter uma visão completa do seu patrimônio.',
  },
  {
    icon: 'bx-bullseye',
    title: 'Metas & Objetivos',
    description: 'Defina metas financeiras, acompanhe o progresso e realize seus sonhos.',
  },
  {
    icon: 'bx-group',
    title: 'Compartilhamento de Contas',
    description: 'Compartilhe contas com familiares e tenha controle financeiro em conjunto.',
  },
  {
    icon: 'bx-shield-alt',
    title: 'Segurança & LGPD',
    description: 'Seus dados criptografados e em conformidade com a LGPD.',
  },
];

const Features = () => {
  return (
    <section id="features" className="section-padding bg-muted/20">
      <div className="container-custom">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-star'></i>
            Recursos
          </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Tudo que você precisa para <span className="gradient-text">ficar tranquilo</span>
            </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ferramentas poderosas para gestão financeira pessoal ou empresarial
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card-hover p-6 group relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {feature.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="badge-pill text-xs bg-primary/20 text-primary border-primary/30">
                    <i className='bx bx-time-five mr-1'></i>
                    Em breve
                  </span>
                </div>
              )}
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                {feature.icon === 'openfinance' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src="/assets/logos/openfinance-round.png"
                      alt="Open Finance"
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                ) : feature.icon === 'bxl-whatsapp' ? (
                  <svg 
                    className="w-6 h-6 text-primary" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                ) : (
                  <i className={`bx ${feature.icon} text-2xl text-primary`}></i>
                )}
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
