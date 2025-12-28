import AppLayout from '@/components/app/AppLayout';

const transactions = [
  { id: 1, description: 'Salário', amount: 8500, type: 'income', date: '2024-01-15', category: 'Receita' },
  { id: 2, description: 'Supermercado Extra', amount: -450, type: 'expense', date: '2024-01-14', category: 'Alimentação' },
  { id: 3, description: 'Aluguel Janeiro', amount: -1800, type: 'expense', date: '2024-01-10', category: 'Moradia' },
  { id: 4, description: 'Freelance Website', amount: 1200, type: 'income', date: '2024-01-08', category: 'Receita' },
  { id: 5, description: 'Restaurante Sushi', amount: -120, type: 'expense', date: '2024-01-07', category: 'Alimentação' },
  { id: 6, description: 'Uber', amount: -45, type: 'expense', date: '2024-01-06', category: 'Transporte' },
  { id: 7, description: 'Netflix', amount: -39, type: 'expense', date: '2024-01-05', category: 'Entretenimento' },
  { id: 8, description: 'Farmácia', amount: -85, type: 'expense', date: '2024-01-04', category: 'Saúde' },
  { id: 9, description: 'Conta de Luz', amount: -180, type: 'expense', date: '2024-01-03', category: 'Contas' },
  { id: 10, description: 'Internet', amount: -120, type: 'expense', date: '2024-01-02', category: 'Contas' },
];

const Transactions = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Transações</h1>
            <p className="text-muted-foreground">Gerencie suas receitas e despesas</p>
          </div>
          <button className="btn-primary">
            <i className='bx bx-plus'></i>
            Nova Transação
          </button>
        </div>

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
                <input
                  type="text"
                  placeholder="Buscar transação..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>
            <select className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[150px]">
              <option value="">Todas categorias</option>
              <option value="alimentacao">Alimentação</option>
              <option value="moradia">Moradia</option>
              <option value="transporte">Transporte</option>
              <option value="receita">Receita</option>
            </select>
            <select className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors min-w-[120px]">
              <option value="">Todos tipos</option>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>
        </div>

        {/* Transactions table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Categoria</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="text-center py-4 px-6 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                          }`}
                        >
                          <i
                            className={`bx ${tx.amount > 0 ? 'bx-trending-up text-green-500' : 'bx-trending-down text-red-500'}`}
                          ></i>
                        </div>
                        <span className="font-medium">{tx.description}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="badge-pill text-xs">{tx.category}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{tx.date}</td>
                    <td
                      className={`py-4 px-6 text-right font-medium ${
                        tx.amount > 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                          <i className='bx bx-edit text-lg'></i>
                        </button>
                        <button className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                          <i className='bx bx-trash text-lg'></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Mostrando 1-10 de 50 transações</p>
            <div className="flex gap-2">
              <button className="btn-secondary py-2 px-4 text-sm">Anterior</button>
              <button className="btn-primary py-2 px-4 text-sm">Próximo</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Transactions;
