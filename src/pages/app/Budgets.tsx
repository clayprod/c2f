import AppLayout from '@/components/app/AppLayout';

const budgets = [
  { id: 1, name: 'Alimentação', limit: 1500, spent: 1120, color: 'from-orange-500 to-red-500' },
  { id: 2, name: 'Transporte', limit: 600, spent: 320, color: 'from-blue-500 to-cyan-500' },
  { id: 3, name: 'Entretenimento', limit: 400, spent: 450, color: 'from-purple-500 to-pink-500' },
  { id: 4, name: 'Saúde', limit: 300, spent: 85, color: 'from-green-500 to-emerald-500' },
  { id: 5, name: 'Contas', limit: 2000, spent: 1800, color: 'from-yellow-500 to-orange-500' },
];

const Budgets = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">Defina limites e acompanhe seus gastos</p>
          </div>
          <button className="btn-primary">
            <i className='bx bx-plus'></i>
            Novo Orçamento
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <i className='bx bx-target-lock text-xl text-primary'></i>
              </div>
              <span className="text-sm text-muted-foreground">Total Orçado</span>
            </div>
            <p className="font-display text-2xl font-bold">R$ 4.800,00</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <i className='bx bx-pie-chart-alt-2 text-xl text-yellow-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Total Gasto</span>
            </div>
            <p className="font-display text-2xl font-bold">R$ 3.775,00</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <i className='bx bx-check-circle text-xl text-green-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Disponível</span>
            </div>
            <p className="font-display text-2xl font-bold text-green-500">R$ 1.025,00</p>
          </div>
        </div>

        {/* Budgets list */}
        <div className="grid gap-4">
          {budgets.map((budget) => {
            const percentage = Math.min((budget.spent / budget.limit) * 100, 100);
            const isOverBudget = budget.spent > budget.limit;

            return (
              <div key={budget.id} className="glass-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${budget.color} flex items-center justify-center`}>
                      <i className='bx bx-category text-white text-xl'></i>
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">{budget.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Limite: R$ {budget.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`font-display text-xl font-bold ${isOverBudget ? 'text-red-500' : ''}`}>
                      R$ {budget.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isOverBudget ? (
                        <span className="text-red-500">
                          Excedido em R$ {(budget.spent - budget.limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <>Restam R$ {(budget.limit - budget.spent).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${
                      isOverBudget ? 'from-red-500 to-red-600' : budget.color
                    } transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{percentage.toFixed(0)}% utilizado</p>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Budgets;
