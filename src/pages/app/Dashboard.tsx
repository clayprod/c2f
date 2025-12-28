import AppLayout from '@/components/app/AppLayout';

const mockData = {
  balance: 12450.00,
  income: 8500.00,
  expenses: 4230.00,
  savings: 4270.00,
};

const recentTransactions = [
  { id: 1, description: 'Salário', amount: 8500, type: 'income', date: '2024-01-15', category: 'Receita' },
  { id: 2, description: 'Supermercado', amount: -450, type: 'expense', date: '2024-01-14', category: 'Alimentação' },
  { id: 3, description: 'Aluguel', amount: -1800, type: 'expense', date: '2024-01-10', category: 'Moradia' },
  { id: 4, description: 'Freelance', amount: 1200, type: 'income', date: '2024-01-08', category: 'Receita' },
  { id: 5, description: 'Restaurante', amount: -120, type: 'expense', date: '2024-01-07', category: 'Alimentação' },
];

const advisorInsights = [
  {
    icon: 'bx-trending-up',
    title: 'Gastos com alimentação',
    description: 'Seus gastos com alimentação aumentaram 15% este mês. Considere definir um orçamento.',
    type: 'warning',
  },
  {
    icon: 'bx-check-circle',
    title: 'Meta de economia',
    description: 'Você está no caminho certo! Já economizou 50% da sua meta mensal.',
    type: 'success',
  },
];

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas finanças</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <i className='bx bx-wallet text-xl text-primary'></i>
              </div>
              <span className="text-sm text-muted-foreground">Saldo Total</span>
            </div>
            <p className="font-display text-2xl font-bold">
              R$ {mockData.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <i className='bx bx-trending-up text-xl text-green-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Receitas</span>
            </div>
            <p className="font-display text-2xl font-bold text-green-500">
              +R$ {mockData.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <i className='bx bx-trending-down text-xl text-red-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Despesas</span>
            </div>
            <p className="font-display text-2xl font-bold text-red-500">
              -R$ {mockData.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <i className='bx bx-coin-stack text-xl text-secondary'></i>
              </div>
              <span className="text-sm text-muted-foreground">Economia</span>
            </div>
            <p className="font-display text-2xl font-bold">
              R$ {mockData.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart area */}
          <div className="lg:col-span-2 glass-card p-6">
            <h2 className="font-display font-semibold mb-4">Fluxo de Caixa</h2>
            <div className="h-64 flex items-end justify-around gap-2 p-4 bg-muted/20 rounded-xl">
              {[40, 60, 30, 80, 55, 70, 45, 90, 65, 75, 50, 85].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary/40 rounded-t transition-all hover:from-primary hover:to-primary/60"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <i className='bx bx-bot text-xl text-primary'></i>
              <h2 className="font-display font-semibold">Insights do Advisor</h2>
            </div>
            <div className="space-y-4">
              {advisorInsights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl border ${
                    insight.type === 'warning'
                      ? 'bg-yellow-500/5 border-yellow-500/20'
                      : 'bg-green-500/5 border-green-500/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <i
                      className={`bx ${insight.icon} text-xl ${
                        insight.type === 'warning' ? 'text-yellow-500' : 'text-green-500'
                      }`}
                    ></i>
                    <div>
                      <h3 className="font-medium text-sm mb-1">{insight.title}</h3>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Transações Recentes</h2>
            <a href="/app/transactions" className="text-sm text-primary hover:underline">
              Ver todas
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm">{tx.description}</td>
                    <td className="py-3 px-4">
                      <span className="badge-pill text-xs">{tx.category}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{tx.date}</td>
                    <td
                      className={`py-3 px-4 text-sm text-right font-medium ${
                        tx.amount > 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
