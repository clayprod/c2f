'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Goal {
  id: string;
  name: string;
  description?: string;
  target_amount_cents: number;
  current_amount_cents: number;
  progress_percentage: number;
  target_date?: string;
  status: string;
  priority: string;
  icon: string;
  color: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const result = await response.json();
      if (result.data) {
        setGoals(result.data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
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
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount_cents, 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + g.current_amount_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Objetivos</h1>
          <p className="text-muted-foreground">Crie metas e poupe com "caixinhas"</p>
        </div>
        <Link href="/app/goals/new" className="btn-primary">
          <i className='bx bx-plus'></i>
          Novo Objetivo
        </Link>
      </div>

      {/* Summary */}
      {activeGoals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <i className='bx bx-bullseye text-xl text-primary'></i>
              </div>
              <span className="text-sm text-muted-foreground">Objetivos Ativos</span>
            </div>
            <p className="font-display text-2xl font-bold">{activeGoals.length}</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <i className='bx bx-coin-stack text-xl text-green-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Total Poupado</span>
            </div>
            <p className="font-display text-2xl font-bold">{formatCurrency(totalCurrent)}</p>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <i className='bx bx-target-lock text-xl text-blue-500'></i>
              </div>
              <span className="text-sm text-muted-foreground">Meta Total</span>
            </div>
            <p className="font-display text-2xl font-bold">{formatCurrency(totalTarget)}</p>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className='bx bx-bullseye text-4xl text-muted-foreground mb-4'></i>
          <h3 className="font-display font-semibold mb-2">Nenhum objetivo cadastrado</h3>
          <p className="text-muted-foreground mb-6">
            Crie objetivos e use "caixinhas" para poupar dinheiro
          </p>
          <Link href="/app/goals/new" className="btn-primary">
            <i className='bx bx-plus'></i>
            Criar Objetivo
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {activeGoals.length > 0 && (
            <div>
              <h2 className="font-display font-semibold mb-4">Objetivos Ativos</h2>
              <div className="grid gap-4">
                {activeGoals.map((goal) => (
                  <div key={goal.id} className="glass-card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                        >
                          {goal.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-display font-semibold text-lg mb-1">{goal.name}</h3>
                          {goal.description && (
                            <p className="text-sm text-muted-foreground mb-2">{goal.description}</p>
                          )}
                          {goal.target_date && (
                            <p className="text-sm text-muted-foreground">
                              Meta: {new Date(goal.target_date).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/app/goals/${goal.id}`}
                        className="text-primary hover:underline text-sm"
                      >
                        Ver detalhes
                      </Link>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">
                          {formatCurrency(goal.current_amount_cents)} / {formatCurrency(goal.target_amount_cents)}
                        </span>
                      </div>
                      <div className="w-full bg-muted/20 rounded-full h-3">
                        <div
                          className="bg-primary rounded-full h-3 transition-all"
                          style={{ width: `${Math.min(goal.progress_percentage || 0, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {goal.progress_percentage?.toFixed(1) || 0}% concluído
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h2 className="font-display font-semibold mb-4">Objetivos Concluídos</h2>
              <div className="grid gap-4">
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="glass-card p-6 opacity-75">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                      >
                        {goal.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold">{goal.name}</h3>
                          <span className={`badge-pill text-xs ${getStatusColor(goal.status)}`}>
                            Concluído
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(goal.current_amount_cents)} / {formatCurrency(goal.target_amount_cents)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

