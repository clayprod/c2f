import { useState } from 'react';
import AppLayout from '@/components/app/AppLayout';

const suggestedActions = [
  {
    id: 1,
    title: 'Reduzir gastos com alimentação',
    description: 'Seus gastos com alimentação estão 15% acima do orçamento. Considere cozinhar mais em casa.',
    impact: 'Economia potencial: R$ 200/mês',
    icon: 'bx-restaurant',
    priority: 'high',
  },
  {
    id: 2,
    title: 'Criar reserva de emergência',
    description: 'Você ainda não tem uma reserva de emergência configurada. Sugerimos guardar 10% da renda.',
    impact: 'Meta: R$ 10.000',
    icon: 'bx-shield',
    priority: 'medium',
  },
  {
    id: 3,
    title: 'Cancelar assinaturas não usadas',
    description: 'Identificamos 2 assinaturas que você não usa há 3 meses: Spotify e Academia.',
    impact: 'Economia: R$ 130/mês',
    icon: 'bx-credit-card',
    priority: 'low',
  },
];

const weeklyInsights = [
  'Você gastou 20% menos que na semana passada',
  'Maior gasto: Supermercado (R$ 450)',
  'Categoria mais econômica: Transporte (-30%)',
  'Próxima conta: Aluguel em 5 dias (R$ 1.800)',
];

const Advisor = () => {
  const [message, setMessage] = useState('');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">AI Advisor</h1>
          <p className="text-muted-foreground">Insights e recomendações personalizadas</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chat area */}
          <div className="lg:col-span-2 glass-card flex flex-col h-[600px]">
            {/* Chat header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <i className='bx bx-bot text-primary-foreground text-xl'></i>
              </div>
              <div>
                <h2 className="font-display font-semibold">c2 Advisor</h2>
                <p className="text-xs text-muted-foreground">Online • Pronto para ajudar</p>
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 p-4 overflow-auto space-y-4">
              {/* Bot message */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <i className='bx bx-bot text-primary'></i>
                </div>
                <div className="glass-card p-4 max-w-[80%]">
                  <p className="text-sm">
                    Olá! Sou o c2 Advisor, sua IA financeira pessoal. 👋
                    <br /><br />
                    Analisei suas transações recentes e tenho algumas recomendações:
                  </p>
                  <ul className="mt-3 space-y-2">
                    {weeklyInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <i className='bx bx-check-circle text-primary flex-shrink-0 mt-0.5'></i>
                        <span className="text-muted-foreground">{insight}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm">
                    Quer que eu detalhe algum ponto ou tem alguma pergunta?
                  </p>
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Pergunte algo ao Advisor..."
                  className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <button className="btn-primary px-5">
                  <i className='bx bx-send'></i>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <i className='bx bx-info-circle'></i> Plano Free: 2 consultas restantes este mês
              </p>
            </div>
          </div>

          {/* Suggested actions */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold">Ações Sugeridas</h2>
            {suggestedActions.map((action) => (
              <div
                key={action.id}
                className={`glass-card p-4 border-l-4 ${
                  action.priority === 'high'
                    ? 'border-l-red-500'
                    : action.priority === 'medium'
                    ? 'border-l-yellow-500'
                    : 'border-l-green-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <i className={`bx ${action.icon} text-xl text-foreground`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1">{action.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{action.description}</p>
                    <span className="badge-pill text-xs">{action.impact}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn-primary py-2 px-4 text-xs flex-1">Aplicar</button>
                  <button className="btn-secondary py-2 px-4 text-xs">Ignorar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Advisor;
