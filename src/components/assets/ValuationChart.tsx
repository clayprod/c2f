'use client';

import { formatMonthYear } from '@/lib/utils';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Valuation {
  id: string;
  valuation_date: string;
  value_cents: number;
  valuation_type: 'manual' | 'depreciation' | 'market';
  notes?: string;
}

type DataPointType = 'purchase' | 'current' | 'manual' | 'depreciation' | 'market';

interface ValuationChartProps {
  valuations: Valuation[];
  purchaseDate: string;
  purchasePriceCents: number;
  currentValueCents?: number;
}

export default function ValuationChart({ valuations, purchaseDate, purchasePriceCents, currentValueCents }: ValuationChartProps) {

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string, index: number, allDates: string[]) => {
    const dateObj = new Date(dateString);
    
    // Check if there are multiple dates in the same month/year
    const monthYear = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const sameMonthDates = allDates.filter(d => {
      const dObj = new Date(d);
      const dMonthYear = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
      return dMonthYear === monthYear;
    });
    
    // If multiple dates in same month, show day as well to differentiate
    if (sameMonthDates.length > 1) {
      return format(dateObj, 'dd/MM/yy', { locale: pt });
    }
    
    // Otherwise, show month/year format
    const result = formatMonthYear(dateString);
    return typeof result === 'string' ? result : result.formatted;
  };

  // Combine purchase date with valuations
  // Remove duplicates by date to avoid showing same date twice
  const today = new Date().toISOString().split('T')[0];
  const dataPoints: Array<{ date: string; value: number; type: DataPointType; label: string }> = [
    {
      date: purchaseDate,
      value: purchasePriceCents,
      type: 'purchase',
      label: 'Compra',
    },
    ...valuations.map(v => ({
      date: v.valuation_date,
      value: v.value_cents,
      type: v.valuation_type as DataPointType,
      label: v.valuation_type === 'manual' ? 'Manual' : v.valuation_type === 'depreciation' ? 'Depreciação' : 'Mercado',
    })),
  ];

  // Add current value point if it's different from purchase and not already in valuations
  const latestValuationDate = valuations.length > 0 
    ? valuations[valuations.length - 1].valuation_date 
    : null;
  const hasCurrentValueChanged = currentValueCents !== undefined && 
    currentValueCents !== null && 
    currentValueCents !== purchasePriceCents;
  const latestIsNotToday = !latestValuationDate || latestValuationDate !== today;
  
  if (hasCurrentValueChanged && latestIsNotToday) {
    dataPoints.push({
      date: today,
      value: currentValueCents,
      type: 'current',
      label: 'Atual',
    });
  }

  const allData = dataPoints
    // Remove duplicates: if purchase date matches a valuation date, keep only the valuation
    .filter((item, index, self) => {
      if (item.type === 'purchase') {
        // Keep purchase if no valuation has the same date
        return !self.some(v => v.type !== 'purchase' && v.date === item.date);
      }
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
  
  // Helper function to calculate safe coordinates
  const getPointCoordinates = (index: number, value: number) => {
    const totalPoints = allData.length;
    if (totalPoints <= 1) {
      return { x: 50, y: 50 };
    }
    const x = Number(((index / (totalPoints - 1)) * 100).toFixed(2));
    const yPercent = ((maxValue - value) / range) * 100;
    const y = Number(Math.max(0, Math.min(100, yPercent)).toFixed(2));
    // Ensure we return valid numbers, not NaN or Infinity
    if (!isFinite(x) || !isFinite(y)) {
      return { x: 50, y: 50 };
    }
    return { x, y };
  };

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
      case 'current':
        return 'bg-cyan-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold mb-4">Histórico de Valorização</h3>
      
      <div className="w-full overflow-x-auto">
        <div className="relative min-w-[400px]" style={{ height: `${chartHeight + 80}px` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-20 w-14 flex flex-col justify-between text-xs text-muted-foreground pr-2">
            <span className="text-right">{formatCurrency(maxValue)}</span>
            <span className="text-right">{formatCurrency((minValue + maxValue) / 2)}</span>
            <span className="text-right">{formatCurrency(minValue)}</span>
          </div>

          {/* Chart area */}
          <div className="ml-14 mr-2 relative" style={{ height: `${chartHeight}px` }}>
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 0.5, 1].map((pos) => (
                <div
                  key={pos}
                  className="border-t border-border/20 w-full"
                  style={{ 
                    position: 'absolute',
                    top: pos === 0 ? '0' : pos === 0.5 ? '50%' : '100%',
                    left: 0,
                    right: 0
                  }}
                />
              ))}
            </div>

            {/* Data points and line */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Line connecting points */}
              {allData.length > 1 && (() => {
                try {
                  const points = allData.map((d, i) => {
                    const coords = getPointCoordinates(i, d.value);
                    return `${coords.x},${coords.y}`;
                  }).join(' ');
                  return (
                    <polyline
                      points={points}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-primary opacity-60"
                    />
                  );
                } catch (error) {
                  console.error('Error rendering polyline:', error);
                  return null;
                }
              })()}

              {/* Data points */}
              {allData.map((d, i) => {
                try {
                  const coords = getPointCoordinates(i, d.value);
                  return (
                    <g key={i}>
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r="2"
                        className={getColor(d.type)}
                        fill="currentColor"
                      />
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r="4"
                        className={getColor(d.type)}
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                    </g>
                  );
                } catch (error) {
                  console.error('Error rendering data point:', error);
                  return null;
                }
              })}
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="ml-14 mr-2 mt-2 flex justify-between text-xs text-muted-foreground" style={{ height: '60px' }}>
            {allData.map((d, i) => (
              <div 
                key={i} 
                className="text-center flex-1 flex items-start justify-center px-1"
                style={{ minWidth: '60px' }}
              >
                <span 
                  className="block whitespace-nowrap"
                  style={{ 
                    transform: 'rotate(-45deg)',
                    transformOrigin: 'top left',
                    marginLeft: '50%',
                    marginTop: '8px'
                  }}
                >
                  {formatDate(d.date, i, allData.map(dd => dd.date))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Compra</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
          <span>Atual</span>
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


