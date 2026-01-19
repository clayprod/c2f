const metrics = [
  {
    icon: 'bx-user-plus',
    value: '+2.200',
    label: 'usuários',
  },
  {
    icon: 'bx-arrow-right-left',
    value: '+120k',
    label: 'transações analisadas',
  },
  {
    icon: 'bx-check-circle',
    value: '99,9%',
    label: 'uptime',
  },
];

const Metrics = () => {
  return (
    <section className="py-16 md:py-20">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="glass-card-hover p-6 text-center"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <i className={`bx ${metric.icon} text-2xl text-primary`}></i>
              </div>
              <div className="font-display text-3xl md:text-4xl font-bold gradient-text mb-1">
                {metric.value}
              </div>
              <div className="text-muted-foreground text-sm">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Metrics;
