import Link from 'next/link';
import Image from 'next/image';

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
              <i className='bx bx-sparkles'></i>
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
              <Image
                src="/assets/images/frame.jpg"
                alt="Preview do dashboard c2Finance"
                fill
                className="object-cover"
                priority
              />
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
