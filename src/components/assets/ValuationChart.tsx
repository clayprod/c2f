'use client';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Dot } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { formatCurrency, formatCurrencyValue } from '@/lib/utils';

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

interface ChartDataPoint {
  date: string;
  dateTimestamp: number;
  value: number; // em reais
  type: DataPointType;
  label: string;
}

export default function ValuationChart({ valuations, purchaseDate, purchasePriceCents }: ValuationChartProps) {

  // Formatação compacta para eixo do gráfico (sem centavos)
  const formatCurrencyCompact = (reais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(reais);
  };

  const formatDateLabel = (dateString: string) => {
    const dateObj = new Date(dateString + 'T00:00:00');
    return format(dateObj, 'dd/MM/yy', { locale: pt });
  };

  // Combine purchase date with valuations
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

  // Prepare data for Recharts
  const chartData: ChartDataPoint[] = allData.map(point => ({
    date: formatDateLabel(point.date),
    dateTimestamp: new Date(point.date + 'T00:00:00').getTime(),
    value: point.value / 100, // converter centavos para reais
    type: point.type,
    label: point.label,
  }));

  // Chart configuration
  const chartConfig: ChartConfig = {
    value: {
      label: 'Valor',
      color: '#14b8a6',
    },
    purchase: {
      label: 'Compra',
      color: '#3b82f6',
    },
    manual: {
      label: 'Manual',
      color: '#22c55e',
    },
    depreciation: {
      label: 'Depreciação',
      color: '#eab308',
    },
    market: {
      label: 'Mercado',
      color: '#a855f7',
    },
  };

  // Custom dot component that changes color based on type
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;
    
    const type = payload.type as DataPointType;
    const colors: Record<DataPointType, string> = {
      purchase: '#3b82f6',
      manual: '#22c55e',
      depreciation: '#eab308',
      market: '#a855f7',
    };
    const color = colors[type] || '#6b7280';

    return (
      <g>
        {/* Outer circle with opacity */}
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={color}
          fillOpacity={0.2}
        />
        {/* Inner solid circle */}
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill={color}
        />
      </g>
    );
  };

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold mb-4">Histórico de Valorização</h3>
      
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 10, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => {
              // Format large numbers with K notation
              if (value >= 1000) {
                return `R$ ${(value / 1000).toFixed(0)}k`;
              }
              return formatCurrencyCompact(value);
            }}
            width={80}
          />
          <ChartTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload[0]) return null;
              
              const data = payload[0].payload as ChartDataPoint;
              const value = payload[0].value as number;
              
              return (
                <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium mb-1">{data.date}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartConfig[data.type]?.color || '#6b7280' }}></div>
                    <div className="flex flex-col">
                      <span className="font-semibold">{formatCurrencyValue(value)}</span>
                      <span className="text-muted-foreground text-xs">{data.label}</span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ 
              r: 8, 
              stroke: '#14b8a6',
              strokeWidth: 2,
              fill: '#fff'
            }}
          />
        </LineChart>
      </ChartContainer>

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
