'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface Stats {
  total_users: number;
  total_transactions: number;
  total_income: number;
  total_expenses: number;
  plan_distribution: {
    free: number;
    pro: number;
    premium: number;
  };
  user_growth: Array<{ month: string; count: number }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando estatísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center py-8 text-destructive">Erro ao carregar estatísticas</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_transactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_income)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_expenses)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Plano</CardTitle>
          <CardDescription>Número de usuários em cada plano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-muted-foreground">{stats.plan_distribution.free}</div>
              <div className="text-sm text-muted-foreground mt-1">Free</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.plan_distribution.pro}</div>
              <div className="text-sm text-muted-foreground mt-1">Pro</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500">{stats.plan_distribution.premium}</div>
              <div className="text-sm text-muted-foreground mt-1">Premium</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crescimento de Usuários</CardTitle>
          <CardDescription>Últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.user_growth.map((item) => (
              <div key={item.month} className="flex items-center justify-between">
                <span className="text-sm">{item.month}</span>
                <span className="font-medium">{item.count} usuários</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


