const steps = [
  {
    number: '01',
    title: 'Planilhas e bagunça',
    description: 'Dados espalhados, sem visibilidade real do seu dinheiro.',
    icon: 'bx-spreadsheet',
    status: 'before',
  },
  {
    number: '02',
    title: 'Importação inteligente',
    description: 'Importe CSV, OFX ou conecte seus bancos automaticamente.',
    icon: 'bx-import',
    status: 'progress',
  },
  {
    number: '03',
    title: 'Dashboard e categorias',
    description: 'Visualize tudo categorizado, com gráficos claros.',
    icon: 'bx-pie-chart-alt-2',
    status: 'progress',
  },
  {
    number: '04',
    title: 'Advisor com ações e alertas',
    description: 'IA que detecta anomalias e sugere ações concretas.',
    icon: 'bx-bot',
    status: 'after',
  },
];

const Evolution = () => {
  return (
    <section className="section-padding">
      <div className="container-custom">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-trending-up'></i>
            Evolução
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            De caos para <span className="gradient-text">controle</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Uma jornada de transformação financeira em 4 passos simples
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Connection line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-destructive/50 via-primary/50 to-primary hidden md:block" />

          <div className="space-y-8 md:space-y-0">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`relative flex flex-col md:flex-row items-start gap-4 md:gap-8 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Card */}
                <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                  <div className="glass-card-hover p-6 inline-block text-left">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          step.status === 'before'
                            ? 'bg-destructive/20'
                            : step.status === 'after'
                            ? 'bg-primary/20'
                            : 'bg-muted'
                        }`}
                      >
                        <i
                          className={`bx ${step.icon} text-xl ${
                            step.status === 'before'
                              ? 'text-destructive'
                              : step.status === 'after'
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          }`}
                        ></i>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{step.number}</span>
                    </div>
                    <h3 className="font-display font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                </div>

                {/* Center dot */}
                <div className="hidden md:flex items-center justify-center w-4 h-4 rounded-full bg-primary border-4 border-background absolute left-1/2 -translate-x-1/2 top-8" />

                {/* Spacer */}
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Evolution;
