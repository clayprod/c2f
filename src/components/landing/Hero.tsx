import Link from 'next/link';

const Hero = () => {
  return (
    <section className="section-padding pt-32 md:pt-40 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="fade-in-up stagger-1 mb-6">
            <span className="badge-pill">
              <i className='bx bx-brain'></i>
              AI-Powered Financial Control
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="fade-in-up stagger-2 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Controle suas Finanças com um{' '}
            <span className="gradient-text">Advisor de IA</span>
          </h1>

          {/* Subtitle */}
          <p className="fade-in-up stagger-3 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-balance">
            Transações, orçamentos, projeções e insights acionáveis — tudo em um painel simples. 
            Conecte bancos opcionalmente e deixe a IA te orientar.
          </p>

          {/* CTAs */}
          <div className="fade-in-up stagger-4 flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link href="/signup" className="btn-primary w-full sm:w-auto">
              <i className='bx bx-rocket'></i>
              Começar grátis
            </Link>
            <a href="#demo" className="btn-secondary w-full sm:w-auto">
              <i className='bx bx-play-circle'></i>
              Ver demo
            </a>
          </div>

          {/* Trust text */}
          <p className="fade-in-up stagger-5 text-sm text-muted-foreground">
            <i className='bx bx-check-shield text-primary mr-1'></i>
            Sem cartão de crédito no plano grátis
          </p>
        </div>

        {/* Hero Visual */}
        <div className="fade-in-up stagger-6 mt-16 md:mt-20 relative">
          <div className="glass-card p-2 md:p-4 mx-auto max-w-5xl">
            <div className="bg-card rounded-xl overflow-hidden aspect-video relative max-h-[600px]">
              {/* Mock Dashboard Preview */}
              <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-muted/50 p-4 md:p-8">
                <div className="flex gap-4 h-full">
                  {/* Sidebar mock */}
                  <div className="hidden md:block w-16 bg-muted/30 rounded-lg" />
                  
                  {/* Main content mock */}
                  <div className="flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-32 bg-muted/50 rounded-lg" />
                      <div className="h-8 w-8 bg-primary/30 rounded-lg" />
                    </div>
                    
                    {/* Cards row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-muted/30 rounded-lg p-3 md:p-4">
                          <div className="h-3 w-16 bg-muted/50 rounded mb-2" />
                          <div className="h-6 w-20 bg-primary/30 rounded" />
                        </div>
                      ))}
                    </div>
                    
                    {/* Chart area */}
                    <div className="flex-1 bg-muted/20 rounded-lg p-4 min-h-[120px] md:min-h-[200px]">
                      <div className="flex items-end justify-around h-full gap-2">
                        {[40, 60, 30, 80, 55, 70, 45, 90, 65, 75, 50, 85].map((height, i) => (
                          <div
                            key={i}
                            className="w-full bg-gradient-to-t from-primary/60 to-primary/20 rounded-t hidden sm:block"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                        {[40, 60, 80, 55, 90, 65].map((height, i) => (
                          <div
                            key={i}
                            className="w-full bg-gradient-to-t from-primary/60 to-primary/20 rounded-t sm:hidden"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur-2xl opacity-50 -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
