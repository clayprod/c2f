'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Investment {
  id: string;
  name: string;
  type: string;
  institution?: string;
  initial_investment_cents: number;
  current_value_cents: number;
  status: string;
  purchase_date: string;
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvestments();
  }, []);

  const fetchInvestments = async () => {
    try {
      const response = await fetch('/api/investments');
      const result = await response.json();
      if (result.data) {
        setInvestments(result.data);
      }
    } catch (error) {
      console.error('Error fetching investments:', error);
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

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stocks: 'Ações',
      bonds: 'Títulos',
      funds: 'Fundos',
      crypto: 'Criptomoedas',
      real_estate: 'Imóveis',
      other: 'Outros',
    };
    return labels[type] || type;
  };

  const calculateReturn = (initial: number, current: number) => {
    if (initial === 0) return 0;
    return ((current - initial) / initial) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const totalInvested = investments.reduce((sum, inv) => sum + inv.initial_investment_cents, 0);
  const totalCurrent = investments.reduce((sum, inv) => sum + (inv.current_value_cents || inv.initial_investment_cents), 0);
  const totalReturn = calculateReturn(totalInvested, totalCurrent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Investimentos</h1>
          <p className="text-muted-foreground">Acompanhe seus investimentos</p>
        </div>
        <Link href="/app/investments/new" className="btn-primary">
          <i className='bx bx-plus'></i>
          Novo Investimento
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <i className='bx bx-line-chart text-xl text-blue-500'></i>
            </div>
            <span className="text-sm text-muted-foreground">Total Investido</span>
          </div>
          <p className="font-display text-2xl font-bold">{formatCurrency(totalInvested)}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <i className='bx bx-trending-up text-xl text-green-500'></i>
            </div>
            <span className="text-sm text-muted-foreground">Valor Atual</span>
          </div>
          <p className="font-display text-2xl font-bold text-green-500">
            {formatCurrency(totalCurrent)}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              totalReturn >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <i className={`bx ${totalReturn >= 0 ? 'bx-trending-up' : 'bx-trending-down'} text-xl ${
                totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
              }`}></i>
            </div>
            <span className="text-sm text-muted-foreground">Retorno</span>
          </div>
          <p className={`font-display text-2xl font-bold ${
            totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </p>
        </div>
      </div>

      {investments.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <i className='bx bx-line-chart text-4xl text-muted-foreground mb-4'></i>
          <h3 className="font-display font-semibold mb-2">Nenhum investimento cadastrado</h3>
          <p className="text-muted-foreground mb-6">Comece adicionando seu primeiro investimento</p>
          <Link href="/app/investments/new" className="btn-primary">
            <i className='bx bx-plus'></i>
            Adicionar Investimento
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {investments.map((investment) => {
            const returnPercent = calculateReturn(
              investment.initial_investment_cents,
              investment.current_value_cents || investment.initial_investment_cents
            );

            return (
              <div key={investment.id} className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display font-semibold text-lg">{investment.name}</h3>
                      <span className="badge-pill text-xs">
                        {getTypeLabel(investment.type)}
                      </span>
                      {investment.status === 'sold' && (
                        <span className="badge-pill text-xs bg-gray-500/10 text-gray-500 border-gray-500/20">
                          Vendido
                        </span>
                      )}
                    </div>
                    {investment.institution && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {investment.institution}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Comprado em: {new Date(investment.purchase_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Link
                    href={`/app/investments/${investment.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    Ver detalhes
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Investido</p>
                    <p className="font-semibold">
                      {formatCurrency(investment.initial_investment_cents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor Atual</p>
                    <p className="font-semibold">
                      {formatCurrency(investment.current_value_cents || investment.initial_investment_cents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Retorno</p>
                    <p className={`font-semibold ${
                      returnPercent >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%
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

