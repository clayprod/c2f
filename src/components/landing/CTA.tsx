import { Link } from 'react-router-dom';

const CTA = () => {
  return (
    <section className="section-padding relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="glass-card p-8 md:p-16 text-center max-w-4xl mx-auto gradient-border">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Pronto para ter controle <span className="gradient-text">de verdade?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Junte-se a mais de 2.000 usuários que já transformaram sua vida financeira com o c2Finance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="btn-primary text-base w-full sm:w-auto">
              <i className='bx bx-rocket'></i>
              Começar grátis
            </Link>
            <a href="mailto:suporte@c2finance.com" className="btn-secondary text-base w-full sm:w-auto">
              <i className='bx bx-support'></i>
              Falar com suporte
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
