'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlanGuard } from '@/components/app/PlanGuard';

interface Receivable {
  id: string;
  name: string;
  debtor_name?: string;
  total_amount_cents: number;
  received_amount_cents: number;
  remaining_amount_cents: number;
  status: string;
  priority: string;
  due_date?: string;
  interest_rate?: number;
  assigned_to_profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const router = useRouter();

  useEffect(() => {
    fetchReceivables();
  }, [statusFilter, priorityFilter, sortBy, sortOrder]);

  const fetchReceivables = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (priorityFilter) {
        params.append('priority', priorityFilter);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('order', sortOrder);
      }

      const url = `/api/receivables${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.data) {
        setReceivables(result.data);
      }
    } catch (error) {
      console.error('Error fetching receivables:', error);
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
      case 'negociada':
        return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'pendente':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      negociada: 'Negociada',
    };
    return labels[status] || status;
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
    <PlanGuard minPlan="pro">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Recebíveis</h1>
            <p className="text-muted-foreground">Gerencie valores que outras pessoas devem para você</p>
          </div>
          <Link href="/app/receivables/new" className="btn-primary">
            <i className='bx bx-plus'></i>
            Novo Recebível
          </Link>
        </div>

        <div className="glass-card p-4">
          <div className="grid md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">Filtrar por Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="negociada">Negociada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Filtrar por Prioridade</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todas as prioridades</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ordenar por</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="created_at">Data de criação</option>
                <option value="total_amount_cents">Valor total</option>
                <option value="remaining_amount_cents">Valor restante</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Ordem</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="desc">Maior para menor</option>
                <option value="asc">Menor para maior</option>
              </select>
            </div>
          </div>

          {(statusFilter || priorityFilter) && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                }}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border text-sm font-medium transition-colors"
              >
                <i className='bx bx-x'></i> Limpar Filtros
              </button>
            </div>
          )}
        </div>

        {receivables.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <i className='bx bx-receipt text-4xl text-muted-foreground mb-4'></i>
            <h3 className="font-display font-semibold mb-2">
              {statusFilter || priorityFilter ? 'Nenhum recebível encontrado' : 'Nenhum recebível cadastrado'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {statusFilter || priorityFilter
                ? 'Tente ajustar os filtros ou adicione um novo recebível'
                : 'Comece adicionando seu primeiro recebível'}
            </p>
            {(statusFilter || priorityFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPriorityFilter('');
                }}
                className="btn-secondary mb-4"
              >
                <i className='bx bx-x'></i> Limpar Filtros
              </button>
            )}
            <Link href="/app/receivables/new" className="btn-primary">
              <i className='bx bx-plus'></i>
              Adicionar Recebível
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {receivables.map((receivable) => {
              const progress = receivable.total_amount_cents > 0
                ? (receivable.received_amount_cents / receivable.total_amount_cents) * 100
                : 0;

              return (
                <div key={receivable.id} className="glass-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display font-semibold text-lg">{receivable.name}</h3>
                        <span className={`badge-pill text-xs ${getStatusColor(receivable.status)}`}>
                          {getStatusLabel(receivable.status)}
                        </span>
                        {receivable.priority && (
                          <span className={`text-xs font-medium ${getPriorityColor(receivable.priority)}`}>
                            {receivable.priority === 'urgent' ? 'Urgente' :
                              receivable.priority === 'high' ? 'Alta' :
                                receivable.priority === 'medium' ? 'Média' : 'Baixa'}
                          </span>
                        )}
                      </div>
                      {receivable.debtor_name && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Devedor: {receivable.debtor_name}
                        </p>
                      )}
                      {receivable.assigned_to_profile && (
                        <div className="flex items-center gap-2 mb-2">
                          {receivable.assigned_to_profile.avatar_url ? (
                            <img
                              src={receivable.assigned_to_profile.avatar_url}
                              alt={receivable.assigned_to_profile.full_name || 'Avatar'}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                              {(receivable.assigned_to_profile.full_name || receivable.assigned_to_profile.email)[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm text-muted-foreground">
                            Responsável: {receivable.assigned_to_profile.full_name || receivable.assigned_to_profile.email}
                          </span>
                        </div>
                      )}
                      {receivable.due_date && (
                        <p className="text-sm text-muted-foreground">
                          Vencimento: {new Date(receivable.due_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/app/receivables/${receivable.id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      Ver detalhes
                    </Link>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">
                        {formatCurrency(receivable.received_amount_cents)} / {formatCurrency(receivable.total_amount_cents)}
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
                      <p className="font-semibold">{formatCurrency(receivable.total_amount_cents)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Recebido</p>
                      <p className="font-semibold text-green-500">
                        {formatCurrency(receivable.received_amount_cents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Restante</p>
                      <p className="font-semibold text-orange-500">
                        {formatCurrency(receivable.remaining_amount_cents)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PlanGuard>
  );
}
