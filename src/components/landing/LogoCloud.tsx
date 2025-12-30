const logos = [
  { name: 'TechCorp', icon: 'bx-building' },
  { name: 'StartupX', icon: 'bx-rocket' },
  { name: 'FinanceY', icon: 'bx-line-chart' },
  { name: 'CloudZ', icon: 'bx-cloud' },
  { name: 'DataHub', icon: 'bx-server' },
];

const LogoCloud = () => {
  return (
    <section className="py-12 md:py-16 border-y border-border/30">
      <div className="container-custom">
        <p className="text-center text-sm text-muted-foreground mb-8">
          Confiado por empresas inovadoras
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <i className={`bx ${logo.icon} text-2xl`}></i>
              <span className="font-display font-semibold">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogoCloud;
