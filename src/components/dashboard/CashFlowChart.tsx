'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Cell,
  ReferenceArea,
} from 'recharts';
import { formatMonthYear } from '@/lib/utils';

interface MonthlyData {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  balance: number;
  isCurrentMonth: boolean;
  isProjected: boolean;
  income_actual?: number;
  income_planned?: number;
  expenses_actual?: number;
  expenses_planned?: number;
}

interface CashFlowChartProps {
  data: MonthlyData[];
  periodMonths?: number;
}

export function CashFlowChart({ data, periodMonths = 12 }: CashFlowChartProps) {
  const { chartData, currentMonthIndex } = useMemo(() => {
    // Primeiro, processar e formatar os dados
    let runningBalance = 0;
    let lastHistoricalBalance = 0;
    const processedData = data.map((item, index) => {
      runningBalance += item.income - item.expenses;
      // Formatar monthLabel usando formatMonthYear se ainda não estiver formatado
      let formattedMonthLabel = item.monthLabel;
      let isCurrentMonth = item.isCurrentMonth;
      if (item.month) {
        // Se month está no formato YYYY-MM, formatar
        const monthInfoResult = formatMonthYear(item.month, { returnCurrentMonthInfo: true });
        formattedMonthLabel = typeof monthInfoResult === 'string' ? monthInfoResult : monthInfoResult.formatted;
        isCurrentMonth = typeof monthInfoResult === 'object' ? monthInfoResult.isCurrentMonth : false;
      }
      
      if (!item.isProjected) {
        lastHistoricalBalance = runningBalance;
      }
      
      return {
        ...item,
        monthLabel: formattedMonthLabel,
        isCurrentMonth,
        cumulativeBalance: runningBalance,
        // Add opacity for projected vs actual
        incomeOpacity: item.isProjected ? 0.5 : 1,
        expensesOpacity: item.isProjected ? 0.5 : 1,
        balanceDashArray: item.isProjected ? '5 5' : '0',
      };
    });

    // Encontrar índice do mês corrente
    const currentMonthIdx = processedData.findIndex(d => d.isCurrentMonth);
    
    // Se não encontrou mês corrente, usar o último mês histórico
    const finalCurrentMonthIndex = currentMonthIdx >= 0 ? currentMonthIdx : processedData.findIndex(d => !d.isProjected);
    
    if (finalCurrentMonthIndex < 0) {
      // Se não encontrou nenhum mês, retornar dados originais
      return {
        chartData: processedData.map((item, index) => ({
          ...item,
          cumulativeBalanceHistorical: !item.isProjected ? item.cumulativeBalance : null,
          cumulativeBalanceProjected: item.isProjected ? item.cumulativeBalance : null,
        })),
        currentMonthIndex: 0,
      };
    }
    
    // Reorganizar dados para centralizar mês corrente
    // Dividir em histórico (antes do mês corrente) e projeção (depois)
    const historicalData = processedData.slice(0, finalCurrentMonthIndex);
    const currentMonthData = processedData[finalCurrentMonthIndex] ? [processedData[finalCurrentMonthIndex]] : [];
    const projectedData = processedData.slice(finalCurrentMonthIndex + 1);
    
    // Calcular quantos meses mostrar antes e depois do mês corrente
    const halfPeriod = Math.floor(periodMonths / 2);
    const monthsBefore = Math.min(halfPeriod, historicalData.length);
    const monthsAfter = Math.min(halfPeriod, projectedData.length);
    
    // Pegar últimos N meses históricos e primeiros N meses projetados
    const selectedHistorical = historicalData.slice(-monthsBefore);
    const selectedProjected = projectedData.slice(0, monthsAfter);
    
    // Combinar: histórico + mês corrente + projeção
    const reorganizedData = [
      ...selectedHistorical,
      ...currentMonthData,
      ...selectedProjected,
    ];
    
    // Recalcular saldo acumulado para manter continuidade
    let cumulativeBalance = 0;
    if (selectedHistorical.length > 0) {
      // Começar do saldo acumulado do último mês histórico
      cumulativeBalance = selectedHistorical[selectedHistorical.length - 1].cumulativeBalance;
    }
    
    const finalData = reorganizedData.map((item, index) => {
      const isCurrentMonth = index === selectedHistorical.length;
      const isProjected = index > selectedHistorical.length;
      
      if (isProjected) {
        cumulativeBalance += item.income - item.expenses;
      } else {
        cumulativeBalance = item.cumulativeBalance;
      }
      
      // Linha sólida (histórica) deve parar no mês corrente
      // Se for mês corrente com valores reais, incluir na linha sólida
      // Se for mês futuro, não incluir na linha sólida
      const shouldIncludeInHistorical = !isProjected || (isCurrentMonth && !item.isProjected);
      
      // Para criar continuidade: primeiro ponto projetado também tem valor histórico (último histórico)
      const isFirstProjected = isProjected && index === selectedHistorical.length + 1;
      const isLastHistorical = !isProjected && index === selectedHistorical.length - 1;
      
      return {
        ...item,
        isProjected: isProjected && !isCurrentMonth, // Mês corrente não é projetado se tiver valores reais
        cumulativeBalance,
        // Linha sólida: apenas até o mês corrente (se tiver valores reais) ou até o último mês histórico
        cumulativeBalanceHistorical: shouldIncludeInHistorical 
          ? cumulativeBalance 
          : (isFirstProjected ? reorganizedData[selectedHistorical.length]?.cumulativeBalance : null),
        // Linha tracejada: apenas para meses futuros (não mês corrente)
        cumulativeBalanceProjected: isProjected && !isCurrentMonth
          ? cumulativeBalance 
          : (isLastHistorical && !isCurrentMonth ? cumulativeBalance : null),
      };
    });
    
    return {
      chartData: finalData,
      currentMonthIndex: selectedHistorical.length,
    };
  }, [data, periodMonths]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Encontrar o item de dados correspondente ao label
      const dataItem = chartData.find((item) => item.monthLabel === label);
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          
          {/* Receitas */}
          {dataItem && (
            <>
              {dataItem.income_actual !== undefined && dataItem.income_actual > 0 && (
                <p className="text-sm" style={{ color: 'hsl(142, 71%, 45%)' }}>
                  Receitas: {formatCurrency(dataItem.income_actual)} <span className="text-muted-foreground">(realizado)</span>
                </p>
              )}
              {dataItem.income_planned !== undefined && 
               dataItem.income_planned > 0 && 
               (dataItem.income_actual === undefined || dataItem.income_actual !== dataItem.income_planned) && (
                <p className="text-sm opacity-70" style={{ color: 'hsl(142, 71%, 45%)' }}>
                  Receitas: {formatCurrency(dataItem.income_planned)} <span className="text-muted-foreground">(projetado)</span>
                </p>
              )}
              
              {/* Despesas */}
              {dataItem.expenses_actual !== undefined && dataItem.expenses_actual > 0 && (
                <p className="text-sm" style={{ color: 'hsl(0, 84%, 60%)' }}>
                  Despesas: {formatCurrency(dataItem.expenses_actual)} <span className="text-muted-foreground">(realizado)</span>
                </p>
              )}
              {dataItem.expenses_planned !== undefined && 
               dataItem.expenses_planned > 0 && 
               (dataItem.expenses_actual === undefined || dataItem.expenses_actual !== dataItem.expenses_planned) && (
                <p className="text-sm opacity-70" style={{ color: 'hsl(0, 84%, 60%)' }}>
                  Despesas: {formatCurrency(dataItem.expenses_planned)} <span className="text-muted-foreground">(projetado)</span>
                </p>
              )}
            </>
          )}
          
          {/* Saldo Acumulado */}
          {payload.map((entry: any, index: number) => {
            if (entry.name === 'Saldo Acumulado' || entry.name === 'Saldo Acumulado (Proj.)') {
              const isProjected = entry.name === 'Saldo Acumulado (Proj.)';
              return (
                <p key={index} style={{ color: entry.color }} className={`text-sm ${isProjected ? 'opacity-70' : ''}`}>
                  {entry.name}: {formatCurrency(entry.value)} {isProjected && <span className="text-muted-foreground">(projetado)</span>}
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
          <XAxis
            dataKey="monthLabel"
            angle={-45}
            textAnchor="end"
            height={100}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Fundo azul transparente para mês corrente - cobre toda a área do mês */}
          {currentMonthIndex >= 0 && currentMonthIndex < chartData.length && (() => {
            const currentMonthValue = chartData[currentMonthIndex]?.monthLabel;
            if (!currentMonthValue) return null;
            
            // Para criar uma área visual maior, usar o mês anterior e próximo como limites
            // Isso cria um fundo que cobre toda a área do mês corrente
            const prevIndex = currentMonthIndex > 0 ? currentMonthIndex - 1 : currentMonthIndex;
            const nextIndex = currentMonthIndex < chartData.length - 1 ? currentMonthIndex + 1 : currentMonthIndex;
            
            // Se há mês anterior e próximo, criar área entre eles
            // Caso contrário, usar apenas o mês corrente
            if (prevIndex < currentMonthIndex && nextIndex > currentMonthIndex) {
              const prevValue = chartData[prevIndex]?.monthLabel;
              const nextValue = chartData[nextIndex]?.monthLabel;
              // Criar área do meio do mês anterior ao meio do próximo
              return (
                <ReferenceArea
                  x1={prevValue}
                  x2={nextValue}
                  y1="dataMin"
                  y2="dataMax"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              );
            } else {
              // Fallback: usar apenas o mês corrente
              return (
                <ReferenceArea
                  x1={currentMonthValue}
                  x2={currentMonthValue}
                  y1="dataMin"
                  y2="dataMax"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              );
            }
          })()}
          
          {/* Income bars - green, with opacity for projected */}
          <Bar
            dataKey="income"
            name="Receitas"
            fill="hsl(142, 71%, 45%)"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => {
              // Se houver valores reais, mostrar sólido; senão, mostrar projetado apagado
              const hasActualValues = entry.income_actual !== undefined && entry.income_actual > 0;
              const isCurrentMonth = index === currentMonthIndex;
              const shouldBeSolid = !entry.isProjected || (isCurrentMonth && hasActualValues);
              
              return (
                <Cell
                  key={`income-cell-${index}`}
                  fill="hsl(142, 71%, 45%)"
                  fillOpacity={shouldBeSolid ? 1 : 0.5}
                />
              );
            })}
          </Bar>
          
          {/* Expense bars - red, with opacity for projected */}
          <Bar
            dataKey="expenses"
            name="Despesas"
            fill="hsl(0, 84%, 60%)"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => {
              // Se houver valores reais, mostrar sólido; senão, mostrar projetado apagado
              const hasActualValues = entry.expenses_actual !== undefined && entry.expenses_actual > 0;
              const isCurrentMonth = index === currentMonthIndex;
              const shouldBeSolid = !entry.isProjected || (isCurrentMonth && hasActualValues);
              
              return (
                <Cell
                  key={`expenses-cell-${index}`}
                  fill="hsl(0, 84%, 60%)"
                  fillOpacity={shouldBeSolid ? 1 : 0.5}
                />
              );
            })}
          </Bar>
          
          {/* Balance line - sólida para histórico */}
          <Line
            type="monotone"
            dataKey="cumulativeBalanceHistorical"
            name="Saldo Acumulado"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={(props: any) => {
              const { payload } = props;
              if (!payload || payload.cumulativeBalanceHistorical === null || payload.cumulativeBalanceHistorical === undefined) {
                // Return an empty SVG element instead of null
                return <g />;
              }
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="hsl(var(--primary))"
                />
              );
            }}
            activeDot={{ r: 6 }}
            connectNulls={true}
          />
          {/* Balance line - tracejada para projeção */}
          <Line
            type="monotone"
            dataKey="cumulativeBalanceProjected"
            name="Saldo Acumulado (Proj.)"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={(props: any) => {
              const { payload } = props;
              if (!payload || payload.cumulativeBalanceProjected === null || payload.cumulativeBalanceProjected === undefined) {
                // Return an empty SVG element instead of null
                return <g />;
              }
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.5}
                />
              );
            }}
            activeDot={{ r: 6 }}
            connectNulls={true}
            opacity={0.5}
          />
          
          {/* Legenda customizada mais clara */}
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            content={() => (
              <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }}></div>
                  <span>Receitas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded opacity-50" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }}></div>
                  <span>Receitas (Proj.)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
                  <span>Despesas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded opacity-50" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
                  <span>Despesas (Proj.)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 rounded" style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
                  <span>Saldo Acumulado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 rounded" style={{ 
                    background: 'repeating-linear-gradient(to right, hsl(var(--primary)) 0px, hsl(var(--primary)) 3px, transparent 3px, transparent 6px)',
                    backgroundColor: 'transparent'
                  }}></div>
                  <span>Saldo Acumulado (Proj.)</span>
                </div>
              </div>
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

