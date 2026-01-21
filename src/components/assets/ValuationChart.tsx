'use client';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Valuation {
  id: string;
  valuation_date: string;
  value_cents: number;
  valuation_type: 'manual' | 'depreciation' | 'market';
  notes?: string;
}

type DataPointType = 'purchase' | 'manual' | 'depreciation' | 'market';

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

  const formatDateLabel = (dateString: string) => {
    const dateObj = new Date(dateString + 'T00:00:00');
    return format(dateObj, 'dd/MM/yy', { locale: pt });
  };

  // Combine purchase date with valuations
  // The last valuation represents the current value of the asset
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

  // If only one data point, show a simple display instead of a chart
  if (allData.length === 1) {
    const point = allData[0];
    return (
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">Histórico de Valorização</h3>
        <div className="text-center py-8">
          <div className="text-2xl font-bold mb-2">{formatCurrency(point.value)}</div>
          <div className="text-sm text-muted-foreground">
            {formatDateLabel(point.date)} - {point.label}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Adicione mais avaliações para visualizar o histórico de valorização
          </p>
        </div>
        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm justify-center">
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

  // Calculate time-based X positions
  const dates = allData.map(d => new Date(d.date + 'T00:00:00').getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const minValue = Math.min(...allData.map(d => d.value));
  const maxValue = Math.max(...allData.map(d => d.value));
  const valueRange = maxValue - minValue;
  
  // Add padding to Y-axis if all values are the same
  const yPadding = valueRange === 0 ? maxValue * 0.1 || 1000 : 0;
  const adjustedMinValue = minValue - yPadding;
  const adjustedMaxValue = maxValue + yPadding;
  const adjustedRange = adjustedMaxValue - adjustedMinValue;
  
  const chartHeight = 200;
  const chartPadding = 5; // Padding from edges in percentage
  
  // Helper function to calculate coordinates based on actual time
  const getPointCoordinates = (index: number) => {
    const point = allData[index];
    const dateTime = new Date(point.date + 'T00:00:00').getTime();
    
    // X position based on time (with padding)
    const xPercent = ((dateTime - minDate) / dateRange) * (100 - 2 * chartPadding) + chartPadding;
    const x = Number(xPercent.toFixed(2));
    
    // Y position based on value
    const yPercent = ((adjustedMaxValue - point.value) / adjustedRange) * 100;
    const y = Number(Math.max(0, Math.min(100, yPercent)).toFixed(2));
    
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
      default:
        return 'bg-gray-500';
    }
  };

  const getStrokeColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return '#3b82f6';
      case 'manual':
        return '#22c55e';
      case 'depreciation':
        return '#eab308';
      case 'market':
        return '#a855f7';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold mb-4">Histórico de Valorização</h3>
      
      <div className="w-full overflow-x-auto">
        <div className="relative min-w-[400px]" style={{ height: `${chartHeight + 80}px` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-20 w-16 flex flex-col justify-between text-xs text-muted-foreground pr-2">
            <span className="text-right">{formatCurrency(adjustedMaxValue)}</span>
            <span className="text-right">{formatCurrency((adjustedMinValue + adjustedMaxValue) / 2)}</span>
            <span className="text-right">{formatCurrency(adjustedMinValue)}</span>
          </div>

          {/* Chart area */}
          <div className="ml-16 mr-2 relative" style={{ height: `${chartHeight}px` }}>
            {/* Grid lines */}
            <div className="absolute inset-0">
              {[0, 0.5, 1].map((pos) => (
                <div
                  key={pos}
                  className="border-t border-border/20 w-full absolute left-0 right-0"
                  style={{ top: `${pos * 100}%` }}
                />
              ))}
            </div>

            {/* Data points and line */}
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Line connecting points */}
              {allData.length > 1 && (() => {
                const points = allData.map((_, i) => {
                  const coords = getPointCoordinates(i);
                  return `${coords.x},${coords.y}`;
                }).join(' ');
                return (
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: '2px' }}
                  />
                );
              })()}

              {/* Data points */}
              {allData.map((d, i) => {
                const coords = getPointCoordinates(i);
                const color = getStrokeColor(d.type);
                return (
                  <g key={i}>
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r="1.5"
                      fill={color}
                      vectorEffect="non-scaling-stroke"
                      style={{ r: '6px' }}
                    />
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r="2.5"
                      fill={color}
                      fillOpacity="0.2"
                      vectorEffect="non-scaling-stroke"
                      style={{ r: '10px' }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* X-axis labels - positioned absolutely based on data point positions */}
            {allData.map((d, i) => {
              const coords = getPointCoordinates(i);
              return (
                <div
                  key={i}
                  className="absolute text-xs text-muted-foreground whitespace-nowrap"
                  style={{
                    left: `${coords.x}%`,
                    top: '100%',
                    transform: 'translateX(-50%) rotate(-45deg)',
                    transformOrigin: 'top center',
                    marginTop: '8px',
                  }}
                >
                  {formatDateLabel(d.date)}
                </div>
              );
            })}
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


