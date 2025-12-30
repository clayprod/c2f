const integrations = [
  {
    name: 'Stripe',
    description: 'Pagamentos e cobranças recorrentes',
    icon: 'bx-card',
    color: 'from-violet-500 to-purple-600',
  },
  {
    name: 'Supabase',
    description: 'Banco de dados seguro e escalável',
    icon: 'bx-server',
    color: 'from-emerald-500 to-green-600',
  },
  {
    name: 'Pluggy',
    description: 'Conexão com bancos brasileiros',
    icon: 'bx-share',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    name: 'n8n',
    description: 'Automações e workflows opcionais',
    icon: 'bx-code-alt',
    color: 'from-orange-500 to-red-600',
  },
];

const Integrations = () => {
  return (
    <section className="section-padding bg-muted/20">
      <div className="container-custom">
        <div className="text-center mb-16">
          <span className="badge-pill mb-4">
            <i className='bx bx-share'></i>
            Integrações
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Conecte com suas <span className="gradient-text">ferramentas</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Integrações nativas com as principais plataformas do mercado
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {integrations.map((integration) => (
            <div key={integration.name} className="glass-card-hover p-6 text-center group">
              <div
                className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${integration.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
              >
                <i className={`${integration.icon} text-2xl text-white`}></i>
              </div>
              <h3 className="font-display font-semibold mb-1">{integration.name}</h3>
              <p className="text-muted-foreground text-xs">{integration.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Integrations;
