const features = [
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
    icon: 'bx-bullseye',
    title: 'Orçamentos & Projeções',
    description: 'Defina metas de gastos e veja projeções baseadas no seu histórico.',
  },
  {
    icon: 'bx-brain',
    title: 'AI Advisor',
    description: 'Insights personalizados e ações sugeridas pela inteligência artificial.',
  },
  {
    icon: 'bx-share',
    title: 'Integração Bancária',
    description: 'Conecte seus bancos via Pluggy/Open Finance (opcional).',
  },
  {
    icon: 'bx-shield-quarter',
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
            Tudo que você precisa para <span className="gradient-text">controlar</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ferramentas poderosas para gestão financeira pessoal ou empresarial
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card-hover p-6 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <i className={`bx ${feature.icon} text-2xl text-primary`}></i>
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
