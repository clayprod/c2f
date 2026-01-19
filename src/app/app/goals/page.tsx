'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { PlanGuard } from '@/components/app/PlanGuard';

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
  image_url?: string;
  image_position?: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);

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

  const handleMarkAsCompleted = async (goalId: string) => {
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (response.ok) {
        // Refresh goals list
        fetchGoals();
      } else {
        console.error('Error marking goal as completed');
      }
    } catch (error) {
      console.error('Error marking goal as completed:', error);
    }
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
  const displayedGoals = showCompleted ? goals : activeGoals;
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount_cents, 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + g.current_amount_cents, 0);

  return (
    <PlanGuard minPlan="pro">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Objetivos</h1>
            <p className="text-muted-foreground">Crie metas e poupe com "caixinhas"</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-muted/80">
              <Switch
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <span>Mostrar concluídos</span>
            </label>
            <Link href="/app/goals/new" className="btn-primary">
              <i className='bx bx-plus'></i>
              Novo Objetivo
            </Link>
          </div>
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
                  <i className='bx bx-coin text-xl text-green-500'></i>
                </div>
                <span className="text-sm text-muted-foreground">Total Poupado</span>
              </div>
              <p className="font-display text-2xl font-bold">{formatCurrency(totalCurrent)}</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <i className='bx bx-bullseye text-xl text-blue-500'></i>
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
            {displayedGoals.length > 0 && (
              <div>
                <h2 className="font-display font-semibold mb-4">
                  {showCompleted ? 'Todos os Objetivos' : 'Objetivos Ativos'}
                </h2>
                <div className="grid gap-4">
                  {displayedGoals.map((goal) => (
                    <div key={goal.id} className="glass-card overflow-hidden">
                      {goal.image_url ? (
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={goal.image_url}
                            alt={goal.name}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: goal.image_position || 'center' }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 dark:from-background/90 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl backdrop-blur-sm"
                                  style={{ backgroundColor: `${goal.color}80`, color: 'white' }}
                                >
                                  {goal.icon}
                                </div>
                                <div className="bg-black/50 px-3 py-2 rounded backdrop-blur-sm inline-block">
                                  <h3 className="font-display font-semibold text-lg mb-1 text-white">{goal.name}</h3>
                                  {goal.target_date && (
                                    <p className="text-sm text-gray-200">
                                      Meta: {new Date(goal.target_date).toLocaleDateString('pt-BR')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {goal.status === 'active' && (
                                  <button
                                    onClick={() => handleMarkAsCompleted(goal.id)}
                                    className="text-green-600 hover:text-green-700 text-sm bg-background/80 px-3 py-1 rounded backdrop-blur-sm flex items-center gap-1"
                                    title="Marcar como concluído"
                                  >
                                    <i className='bx bx-check-circle'></i>
                                    Concluir
                                  </button>
                                )}
                                <Link
                                  href={`/app/goals/${goal.id}`}
                                  className="text-primary hover:underline text-sm bg-background/80 px-3 py-1 rounded backdrop-blur-sm"
                                >
                                  Ver detalhes
                                </Link>
                                <Link
                                  href={`/app/goals/${goal.id}`}
                                  className="text-primary hover:underline text-sm bg-background/80 px-3 py-1 rounded backdrop-blur-sm"
                                >
                                  Editar
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6">
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
                            <div className="flex gap-2">
                              {goal.status === 'active' && (
                                <button
                                  onClick={() => handleMarkAsCompleted(goal.id)}
                                  className="text-green-600 hover:text-green-700 text-sm flex items-center gap-1"
                                  title="Marcar como concluído"
                                >
                                  <i className='bx bx-check-circle'></i>
                                  Concluir
                                </button>
                              )}
                              <Link
                                href={`/app/goals/${goal.id}`}
                                className="text-primary hover:underline text-sm"
                              >
                                Ver detalhes
                              </Link>
                              <Link
                                href={`/app/goals/${goal.id}`}
                                className="text-primary hover:underline text-sm"
                              >
                                Editar
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-6 pt-0">
                        {goal.description && goal.image_url && (
                          <p className="text-sm text-muted-foreground mb-4">{goal.description}</p>
                        )}
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PlanGuard>
  );
}
