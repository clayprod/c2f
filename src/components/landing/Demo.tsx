const bulletPoints = [
  'Detecção de anomalias',
  'Sugestões de orçamento',
  'Insights semanais',
  'Alertas inteligentes',
];

const Demo = () => {
  return (
    <section id="demo" className="section-padding">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="order-2 lg:order-1">
            <span className="badge-pill mb-4">
              <i className='bx bx-play-circle'></i>
              Demo
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Veja o <span className="gradient-text">AI Advisor</span> em ação
            </h2>
            <p className="text-muted-foreground mb-8">
              Nossa IA analisa seus padrões de gastos e oferece recomendações 
              personalizadas para otimizar suas finanças.
            </p>

            <ul className="space-y-4 mb-8">
              {bulletPoints.map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <i className='bx bx-check text-primary'></i>
                  </div>
                  <span className="text-foreground">{point}</span>
                </li>
              ))}
            </ul>

            <a href="#pricing" className="btn-primary">
              <i className='bx bx-rocket'></i>
              Experimentar agora
            </a>
          </div>

          {/* Video Placeholder */}
          <div className="order-1 lg:order-2">
            <div className="glass-card p-2 relative group cursor-pointer">
              <div className="aspect-video bg-gradient-to-br from-muted to-card rounded-xl overflow-hidden relative max-h-[400px]">
                {/* Mock video thumbnail */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm border border-primary/30">
                    <i className='bx bx-play text-4xl text-primary ml-1'></i>
                  </div>
                </div>
                
                {/* Dashboard preview lines */}
                <div className="absolute inset-0 p-6 opacity-30">
                  <div className="space-y-3">
                    <div className="h-4 w-1/3 bg-primary/30 rounded" />
                    <div className="h-24 w-full bg-muted/50 rounded-lg" />
                    <div className="flex gap-3">
                      <div className="h-12 flex-1 bg-muted/50 rounded-lg" />
                      <div className="h-12 flex-1 bg-muted/50 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Glow */}
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Demo;
