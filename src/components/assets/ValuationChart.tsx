'use client';

import { formatMonthYear } from '@/lib/utils';

interface Valuation {
  id: string;
  valuation_date: string;
  value_cents: number;
  valuation_type: 'manual' | 'depreciation' | 'market';
  notes?: string;
}

interface ValuationChartProps {
  valuations: Valuation[];
  purchaseDate: string;
  purchasePriceCents: number;
}

export default function ValuationChart({ valuations, purchaseDate, purchasePriceCents }: ValuationChartProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    const result = formatMonthYear(dateString);
    return typeof result === 'string' ? result : result.formatted;
  };

  // Combine purchase date with valuations
  const allData = [
    {
      date: purchaseDate,
      value: purchasePriceCents,
      type: 'purchase' as const,
      label: 'Compra',
    },
    ...valuations.map(v => ({
      date: v.valuation_date,
      value: v.value_cents,
      type: v.valuation_type,
      label: v.valuation_type === 'manual' ? 'Manual' : v.valuation_type === 'depreciation' ? 'Depreciação' : 'Mercado',
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (allData.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground">
        Nenhuma avaliação registrada ainda
      </div>
    );
  }

  const minValue = Math.min(...allData.map(d => d.value));
  const maxValue = Math.max(...allData.map(d => d.value));
  const range = maxValue - minValue || 1;
  const chartHeight = 200;

  const getColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'bg-blue-500';
      case 'manual':
        return 'bg-green-500';
      case 'depreciation':
        return 'bg-yellow-500';
      case 'market':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold mb-4">Histórico de Valorização</h3>
      
      <div className="relative" style={{ height: `${chartHeight + 60}px` }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
          <span>{formatCurrency(maxValue)}</span>
          <span>{formatCurrency((minValue + maxValue) / 2)}</span>
          <span>{formatCurrency(minValue)}</span>
        </div>

        {/* Chart area */}
        <div className="ml-16 relative" style={{ height: `${chartHeight}px` }}>
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 0.5, 1].map((pos) => (
              <div
                key={pos}
                className="border-t border-border/20"
                style={{ marginTop: pos === 0 ? 0 : pos === 0.5 ? `${chartHeight / 2}px` : `${chartHeight}px` }}
              />
            ))}
          </div>

          {/* Data points and line */}
          <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
            {/* Line connecting points */}
            {allData.length > 1 && (
              <polyline
                points={allData.map((d, i) => {
                  const x = (i / (allData.length - 1)) * 100;
                  const y = ((maxValue - d.value) / range) * 100;
                  return `${x}%,${y}%`;
                }).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary opacity-50"
              />
            )}

            {/* Data points */}
            {allData.map((d, i) => {
              const x = (i / Math.max(allData.length - 1, 1)) * 100;
              const y = ((maxValue - d.value) / range) * 100;
              return (
                <g key={i}>
                  <circle
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="6"
                    className={getColor(d.type)}
                    fill="currentColor"
                  />
                  <circle
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="10"
                    className={getColor(d.type)}
                    fill="currentColor"
                    fillOpacity="0.2"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* X-axis labels */}
        <div className="ml-16 mt-2 flex justify-between text-xs text-muted-foreground">
          {allData.map((d, i) => (
            <div key={i} className="text-center" style={{ flex: 1 }}>
              <div className="transform -rotate-45 origin-top-left" style={{ transformOrigin: 'left top' }}>
                {formatDate(d.date)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Compra</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Manual</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Depreciação</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span>Mercado</span>
        </div>
      </div>
    </div>
  );
}


