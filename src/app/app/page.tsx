'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardData {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number | string;
  posted_at: string;
  categories?: { name: string };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch accounts for balance
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      const accounts = accountsData.data || [];

      // Fetch recent transactions
      const transactionsRes = await fetch('/api/transactions?limit=50');
      if (!transactionsRes.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const transactionsData = await transactionsRes.json();
      const transactions = transactionsData.data || [];

      // Calculate totals
      const totalBalance = accounts.reduce((sum: number, acc: any) => {
        return sum + (parseFloat(acc.current_balance || acc.balance_cents / 100 || 0) || 0);
      }, 0);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const monthTransactions = transactions.filter((tx: Transaction) => {
        const txDate = new Date(tx.posted_at);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });

      const totalIncome = monthTransactions
        .filter((tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          return amount > 0;
        })
        .reduce((sum: number, tx: Transaction) => {
          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
          return sum + amount;
        }, 0);

      const totalExpenses = Math.abs(
        monthTransactions
          .filter((tx: Transaction) => {
            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            return amount < 0;
          })
          .reduce((sum: number, tx: Transaction) => {
            const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            return sum + amount;
          }, 0)
      );

      const savings = totalIncome - totalExpenses;

      setData({
        totalBalance,
        totalIncome,
        totalExpenses,
        savings,
      });

      setRecentTransactions(transactions.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setData({
        totalBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        savings: 0,
      });
      setRecentTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <i className='bx bx-wallet text-xl text-primary'></i>
            </div>
            <span className="text-sm text-muted-foreground">Saldo Total</span>
          </div>
          <p className="font-display text-2xl font-bold">
            {data ? formatCurrency(data.totalBalance) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <i className='bx bx-trending-up text-xl text-green-500'></i>
            </div>
            <span className="text-sm text-muted-foreground">Receitas (Mês)</span>
          </div>
          <p className="font-display text-2xl font-bold text-green-500">
            {data ? formatCurrency(data.totalIncome) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <i className='bx bx-trending-down text-xl text-red-500'></i>
            </div>
            <span className="text-sm text-muted-foreground">Despesas (Mês)</span>
          </div>
          <p className="font-display text-2xl font-bold text-red-500">
            {data ? formatCurrency(data.totalExpenses) : 'R$ 0,00'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <i className='bx bx-coin-stack text-xl text-secondary'></i>
            </div>
            <span className="text-sm text-muted-foreground">Economia (Mês)</span>
          </div>
          <p className={`font-display text-2xl font-bold ${
            data && data.savings >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {data ? formatCurrency(data.savings) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Fluxo de Caixa</h2>
            <Link href="/app/transactions" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
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

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <i className='bx bx-brain text-xl text-primary'></i>
            <h2 className="font-display font-semibold">Insights do Advisor</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-500/20">
              <div className="flex items-start gap-3">
                <i className='bx bx-info-circle text-xl text-blue-500'></i>
                <div>
                  <h3 className="font-medium text-sm mb-1">Bem-vindo!</h3>
                  <p className="text-xs text-muted-foreground">
                    Comece adicionando suas contas e transações para receber insights personalizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Transações Recentes</h2>
          <Link href="/app/transactions" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma transação encontrada</p>
            <Link href="/app/transactions" className="text-primary hover:underline mt-2 inline-block">
              Adicionar transação
            </Link>
          </div>
        ) : (
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
                      <span className="badge-pill text-xs">
                        {tx.categories?.name || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(tx.posted_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td
                      className={`py-3 px-4 text-sm text-right font-medium ${
                        (() => {
                          const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                          return amount > 0 ? 'text-green-500' : 'text-red-500';
                        })()
                      }`}
                    >
                      {(() => {
                        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                        return amount > 0 ? '+' : '';
                      })()}
                      {formatCurrency(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}