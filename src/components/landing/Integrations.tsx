import Image from 'next/image';

const integrations = [
  {
    name: 'WhatsApp',
    description: 'Receba notificações e interaja com seu Advisor financeiro diretamente pelo WhatsApp',
    icon: 'bxl-whatsapp',
    color: 'from-green-500 to-emerald-600',
    available: true,
  },
  {
    name: 'Open Finance',
    description: 'Conecte seus bancos e consolide todas as suas finanças em um único lugar',
    icon: 'openfinance',
    color: 'from-blue-500 to-indigo-600',
    available: false,
    comingSoon: true,
  },
];

const Integrations = () => {
  return (
    <section className="section-padding bg-muted/20 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-share'></i>
            Integrações
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Conecte com suas <span className="gradient-text">ferramentas</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Simplifique sua vida financeira conectando as plataformas que você já usa todos os dias
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className={`glass-card-hover p-8 text-center group relative ${!integration.available ? 'opacity-90' : ''}`}
            >
              {integration.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="badge-pill text-xs bg-primary/20 text-primary border-primary/30">
                    <i className='bx bx-time-five mr-1'></i>
                    Em breve
                  </span>
                </div>
              )}

              <div
                className={`w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br ${integration.color} flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl relative`}
              >
                {integration.icon === 'openfinance' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src="/assets/logos/openfinance-round.png"
                      alt="Open Finance"
                      width={48}
                      height={48}
                      className="object-contain relative z-10 brightness-0 invert"
                      style={{ filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
                ) : integration.icon === 'bxl-whatsapp' ? (
                  <svg 
                    className="w-10 h-10 text-white" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                ) : (
                  <i className={`bx ${integration.icon} text-4xl text-white`}></i>
                )}
              </div>
              
              <h3 className="font-display font-bold text-xl mb-3">{integration.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                {integration.description}
              </p>

              {integration.comingSoon && (
                <p className="text-xs text-muted-foreground mt-4 italic">
                  Implementação futura — seja notificado quando estiver disponível
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Integrations;
