'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Debt {
  id: string;
  name: string;
  creditor_name?: string;
  total_amount_cents: number;
  paid_amount_cents: number;
  remaining_amount_cents: number;
  status: string;
  priority: string;
  due_date?: string;
  interest_rate?: number;
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    try {
      const response = await fetch('/api/debts');
      const result = await response.json();
      if (result.data) {
        setDebts(result.data);
      }
    } catch (error) {
      console.error('Error fetching debts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'overdue':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'negotiating':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Dívidas</h1>
          <p className="text-muted-foreground">Gerencie suas dívidas e pagamentos</p>
        </div>
        <Link href="/app/debts/new" className="btn-primary">
          <i className='bx bx-plus'></i>
          Nova Dívida
        </Link>
      </div>

      {debts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className='bx bx-credit-card text-4xl text-muted-foreground mb-4'></i>
          <h3 className="font-display font-semibold mb-2">Nenhuma dívida cadastrada</h3>
          <p className="text-muted-foreground mb-6">Comece adicionando sua primeira dívida</p>
          <Link href="/app/debts/new" className="btn-primary">
            <i className='bx bx-plus'></i>
            Adicionar Dívida
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {debts.map((debt) => {
            const progress = debt.total_amount_cents > 0
              ? (debt.paid_amount_cents / debt.total_amount_cents) * 100
              : 0;

            return (
              <div key={debt.id} className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display font-semibold text-lg">{debt.name}</h3>
                      <span className={`badge-pill text-xs ${getStatusColor(debt.status)}`}>
                        {debt.status === 'paid' ? 'Paga' :
                         debt.status === 'overdue' ? 'Vencida' :
                         debt.status === 'negotiating' ? 'Negociando' : 'Ativa'}
                      </span>
                      {debt.priority && (
                        <span className={`text-xs font-medium ${getPriorityColor(debt.priority)}`}>
                          {debt.priority === 'urgent' ? 'Urgente' :
                           debt.priority === 'high' ? 'Alta' :
                           debt.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      )}
                    </div>
                    {debt.creditor_name && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Credor: {debt.creditor_name}
                      </p>
                    )}
                    {debt.due_date && (
                      <p className="text-sm text-muted-foreground">
                        Vencimento: {new Date(debt.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/app/debts/${debt.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    Ver detalhes
                  </Link>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">
                      {formatCurrency(debt.paid_amount_cents)} / {formatCurrency(debt.total_amount_cents)}
                    </span>
                  </div>
                  <div className="w-full bg-muted/20 rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">{formatCurrency(debt.total_amount_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pago</p>
                    <p className="font-semibold text-green-500">
                      {formatCurrency(debt.paid_amount_cents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Restante</p>
                    <p className="font-semibold text-red-500">
                      {formatCurrency(debt.remaining_amount_cents)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

