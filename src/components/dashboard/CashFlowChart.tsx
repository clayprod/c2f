'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { formatMonthYear, formatCurrencyValue } from '@/lib/utils';

// Hook to detect mobile screen
function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

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
  const isMobile = useIsMobile();

  const { chartData, currentMonthIndex } = useMemo(() => {
    // Primeiro, processar e formatar os dados
    let runningBalance = 0;
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

      return {
        ...item,
        monthLabel: formattedMonthLabel,
        isCurrentMonth,
        cumulativeBalance: runningBalance,
        // Add opacity for projected vs actual
        // Remove unused opacity props
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
        chartData: processedData.map((item, index) => {
          const incomeActual = item.income_actual !== undefined ? item.income_actual : (!item.isProjected ? item.income : null);
          const incomePlanned = item.income_planned !== undefined ? item.income_planned : (item.isProjected ? item.income : null);
          const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : (!item.isProjected ? item.expenses : null);
          const expensesPlanned = item.expenses_planned !== undefined ? item.expenses_planned : (item.isProjected ? item.expenses : null);

          return {
            ...item,
            cumulativeBalanceHistorical: !item.isProjected ? item.cumulativeBalance : null,
            cumulativeBalanceProjected: item.isProjected ? item.cumulativeBalance : null,
            income_real: (!item.isProjected && incomeActual !== null) ? incomeActual : null,
            income_proj: (item.isProjected && incomePlanned !== null) ? incomePlanned : null,
            expenses_real: (!item.isProjected && expensesActual !== null) ? expensesActual : null,
            expenses_proj: (item.isProjected && expensesPlanned !== null) ? expensesPlanned : null,
          };
        }),
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
    // A linha projetada deve PARTIR do saldo real atual (mês corrente)
    let cumulativeBalanceHistorical = 0;

    if (selectedHistorical.length > 0) {
      // Começar do saldo acumulado do último mês histórico (antes do início do gráfico visível)
      const startBalance = selectedHistorical[0].cumulativeBalance - (selectedHistorical[0].income - selectedHistorical[0].expenses);
      cumulativeBalanceHistorical = startBalance;
    }

    // Primeira passada: calcular apenas o saldo histórico até o mês corrente
    let lastHistoricalBalance = cumulativeBalanceHistorical;
    const tempData = reorganizedData.map((item, index) => {
      const isCurrentMonth = index === selectedHistorical.length;
      const isProjected = index > selectedHistorical.length;

      if (!isProjected) {
        // Para meses históricos ou mês corrente, calcular saldo real
        const incomeActual = item.income_actual !== undefined ? item.income_actual : item.income;
        const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : item.expenses;
        cumulativeBalanceHistorical += incomeActual - expensesActual;
        lastHistoricalBalance = cumulativeBalanceHistorical;
      }

      return {
        ...item,
        isCurrentMonth,
        isProjectedMonth: isProjected,
        cumulativeBalanceHistorical: !isProjected ? cumulativeBalanceHistorical : null,
      };
    });

    // Segunda passada: calcular o saldo projetado PARTINDO do último saldo histórico
    let cumulativeBalanceProjected = lastHistoricalBalance;
    const finalData = tempData.map((item, index) => {
      const isCurrentMonth = item.isCurrentMonth;
      const isProjected = item.isProjectedMonth;

      if (isProjected) {
        // Para meses futuros, somar projeção ao saldo real atual
        cumulativeBalanceProjected += item.income - item.expenses;
      }

      // Linha sólida (histórica) deve parar no mês corrente
      const shouldIncludeInHistorical = !isProjected;

      // A linha projetada começa no mês corrente (mesmo valor do histórico) 
      // e continua nos meses futuros
      const shouldIncludeInProjected = isCurrentMonth || isProjected;

      // Separar valores reais de projetados para as barras
      // Receitas: usar valores explícitos se disponíveis, senão inferir do contexto
      const incomeActual = item.income_actual !== undefined ? item.income_actual : (!isProjected ? item.income : null);
      const incomePlanned = item.income_planned !== undefined ? item.income_planned : (isProjected ? item.income : null);
      
      // Despesas: usar valores explícitos se disponíveis, senão inferir do contexto
      const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : (!isProjected ? item.expenses : null);
      const expensesPlanned = item.expenses_planned !== undefined ? item.expenses_planned : (isProjected ? item.expenses : null);

      // Separar em campos distintos para renderização
      // Valores reais: para meses históricos OU mês corrente quando há valores reais
      const income_real = (!isProjected && incomeActual !== null && incomeActual > 0) ? incomeActual : null;
      const expenses_real = (!isProjected && expensesActual !== null && expensesActual > 0) ? expensesActual : null;
      
      // Valores projetados: para meses futuros OU mês corrente quando há valores projetados
      // Quando há valores reais e projetados no mesmo mês, ambos serão mostrados e a projeção ficará sobreposta
      const hasProjectedIncome = isProjected || (isCurrentMonth && (incomePlanned !== null || item.income > 0));
      const income_proj = hasProjectedIncome && (incomePlanned !== null || (isProjected && item.income > 0)) ? (incomePlanned || item.income) : null;
      
      const hasProjectedExpenses = isProjected || (isCurrentMonth && (expensesPlanned !== null || item.expenses > 0));
      const expenses_proj = hasProjectedExpenses && (expensesPlanned !== null || (isProjected && item.expenses > 0)) ? (expensesPlanned || item.expenses) : null;

      // Flags para indicar quando há sobreposição (valores reais e projetados no mesmo mês)
      const hasIncomeOverlap = income_real !== null && income_proj !== null;
      const hasExpensesOverlap = expenses_real !== null && expenses_proj !== null;

      // Para sobreposição visual: quando há valores reais e projetados, ajustar os dados
      // da projeção para que seja renderizada na mesma posição base da real
      // Com stackId, isso requer que a projeção tenha um offset baseado no valor real
      // Mas na verdade, com stackId, as barras são empilhadas automaticamente
      // Para sobreposição visual, precisamos usar uma técnica diferente
      
      // Ajustar valores projetados para sobreposição visual quando há sobreposição
      // Quando há sobreposição, a projeção deve ser renderizada na mesma posição base
      // Isso é feito ajustando o valor da projeção para incluir o offset da real
      let income_proj_adjusted = income_proj;
      let expenses_proj_adjusted = expenses_proj;
      
      if (hasIncomeOverlap && income_real !== null && income_proj !== null) {
        // Para sobreposição visual, a projeção deve começar na mesma posição base da real
        // Com stackId, isso significa que a projeção deve ter um valor que inclui o offset
        // Mas na verdade, com stackId, não consigo fazer isso diretamente
        // Vou manter o valor original e usar opacidade para diferenciar
        income_proj_adjusted = income_proj;
      }
      
      if (hasExpensesOverlap && expenses_real !== null && expenses_proj !== null) {
        expenses_proj_adjusted = expenses_proj;
      }

      return {
        ...item,
        isProjected: isProjected && !isCurrentMonth,
        cumulativeBalance: item.cumulativeBalanceHistorical || cumulativeBalanceProjected,
        cumulativeBalanceHistorical: shouldIncludeInHistorical ? item.cumulativeBalanceHistorical : null,
        // No mês corrente, a linha projetada tem o mesmo valor da histórica (ponto de encontro)
        // Nos meses futuros, continua com as projeções somadas
        cumulativeBalanceProjected: shouldIncludeInProjected 
          ? (isCurrentMonth ? lastHistoricalBalance : cumulativeBalanceProjected) 
          : null,
        // Campos separados para barras reais e projetadas
        income_real,
        income_proj: income_proj_adjusted,
        expenses_real,
        expenses_proj: expenses_proj_adjusted,
        // Flags para sobreposição visual
        hasIncomeOverlap,
        hasExpensesOverlap,
      };
    });

    return {
      chartData: finalData,
      currentMonthIndex: selectedHistorical.length,
    };
  }, [data, periodMonths]);

  // Formatação compacta para gráficos (sem centavos)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Formatação completa para valores exatos
  const formatCurrencyFull = formatCurrencyValue;

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
              {dataItem.income_real !== null && dataItem.income_real !== undefined && dataItem.income_real > 0 && (
                <p className="text-sm" style={{ color: 'hsl(142, 71%, 35%)' }}>
                  Receitas: {formatCurrency(dataItem.income_real)} <span className="text-muted-foreground">(realizado)</span>
                </p>
              )}
              {dataItem.income_proj !== null && dataItem.income_proj !== undefined && dataItem.income_proj > 0 && (
                <p className="text-sm" style={{ color: 'hsl(142, 71%, 60%)' }}>
                  Receitas: {formatCurrency(dataItem.income_proj)} <span className="text-muted-foreground">(projetado)</span>
                </p>
              )}

              {/* Despesas */}
              {dataItem.expenses_real !== null && dataItem.expenses_real !== undefined && dataItem.expenses_real > 0 && (
                <p className="text-sm" style={{ color: 'hsl(0, 84%, 50%)' }}>
                  Despesas: {formatCurrency(dataItem.expenses_real)} <span className="text-muted-foreground">(realizado)</span>
                </p>
              )}
              {dataItem.expenses_proj !== null && dataItem.expenses_proj !== undefined && dataItem.expenses_proj > 0 && (
                <p className="text-sm" style={{ color: 'hsl(0, 84%, 75%)' }}>
                  Despesas: {formatCurrency(dataItem.expenses_proj)} <span className="text-muted-foreground">(projetado)</span>
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
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
        <ComposedChart
          data={chartData}
          margin={isMobile
            ? { top: 10, right: 10, left: 0, bottom: 50 }
            : { top: 20, right: 30, left: 20, bottom: 60 }
          }
          barGap={0}
          barCategoryGap="20%"
        >

          {/* Patterns removed for cleaner outlined style */}
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
          <XAxis
            dataKey="monthLabel"
            angle={-45}
            textAnchor="end"
            height={isMobile ? 70 : 100}
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            interval={(() => {
              if (isMobile) {
                if (periodMonths <= 6) return 0;
                if (periodMonths <= 12) return 1;
                return 2;
              }
              // Desktop
              if (periodMonths <= 12) return 0; // Show all
              if (periodMonths <= 24) return 1; // Every 2nd
              if (periodMonths <= 60) return 5; // Every 6th
              return 11; // Every 12th
            })()}
            tick={(props: any) => {
              const { x, y, payload } = props;
              const isCurrentMonth = payload.value && chartData[currentMonthIndex]?.monthLabel === payload.value;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={16}
                    textAnchor="end"
                    fill={isCurrentMonth ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    fontSize={isMobile ? 10 : 12}
                    fontWeight={isCurrentMonth ? 'bold' : 'normal'}
                    transform="rotate(-45)"
                  >
                    {payload.value}
                  </text>
                </g>
              );
            }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            tickFormatter={formatCurrency}
            width={isMobile ? 60 : 80}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Fundo destacado para mês corrente - cobre toda a área do mês */}
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
                  fillOpacity={0.25}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.7}
                  strokeWidth={3}
                  strokeDasharray="0"
                  label={{
                    value: '◆ MÊS ATUAL ◆',
                    position: 'top',
                    fill: 'hsl(var(--primary))',
                    fontSize: isMobile ? 12 : 14,
                    fontWeight: 'bold',
                    offset: isMobile ? 10 : 15
                  }}
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
                  fillOpacity={0.25}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.7}
                  strokeWidth={3}
                  strokeDasharray="0"
                  label={{
                    value: '◆ MÊS ATUAL ◆',
                    position: 'top',
                    fill: 'hsl(var(--primary))',
                    fontSize: isMobile ? 12 : 14,
                    fontWeight: 'bold',
                    offset: isMobile ? 10 : 15
                  }}
                  ifOverflow="extendDomain"
                />
              );
            }
          })()}

          {/* Ordem de renderização para empilhar receitas sobre despesas */}
          {/* 1. Despesas Reais - escuro, opacidade 100% (base da pilha) */}
          <Bar
            dataKey="expenses_real"
            name="Despesas (Real)"
            fill="hsl(0, 84%, 50%)"
            radius={[0, 0, 0, 0]}
            stackId="cashflow"
          />

          {/* 2. Despesas Projeção - claro, translúcido (opacidade 55%) */}
          <Bar
            dataKey="expenses_proj"
            name="Despesas (Proj.)"
            fill="hsl(0, 84%, 75%)"
            radius={[0, 0, 0, 0]}
            stackId="cashflow"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`expenses-proj-${index}`} 
                fill="hsl(0, 84%, 75%)" 
                opacity={0.55}
              />
            ))}
          </Bar>

          {/* 3. Receitas Reais - escuro, opacidade 100% (sobre as despesas) */}
          <Bar
            dataKey="income_real"
            name="Receitas (Real)"
            fill="hsl(142, 71%, 35%)"
            radius={[4, 4, 0, 0]}
            stackId="cashflow"
          />

          {/* 4. Receitas Projeção - claro, translúcido (opacidade 55%) */}
          {/* Com stackId, será empilhada sobre a real; a opacidade cria efeito de sobreposição visual */}
          <Bar
            dataKey="income_proj"
            name="Receitas (Proj.)"
            fill="hsl(142, 71%, 60%)"
            radius={[4, 4, 0, 0]}
            stackId="cashflow"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`income-proj-${index}`} 
                fill="hsl(142, 71%, 60%)" 
                opacity={0.55}
              />
            ))}
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
                return <g key={`dot-historical-empty-${props.index}`} />;
              }
              return (
                <circle
                  key={`dot-historical-${props.index}`}
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
                return <g key={`dot-projected-empty-${props.index}`} />;
              }
              return (
                <circle
                  key={`dot-projected-${props.index}`}
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

          {/* Legenda customizada com cores sólidas */}
          <Legend
            wrapperStyle={{ paddingTop: isMobile ? '10px' : '20px' }}
            content={() => (
              <div className={`flex items-center justify-center flex-wrap ${isMobile ? 'gap-x-3 gap-y-1.5 text-xs px-2' : 'gap-6 text-sm'}`}>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{ backgroundColor: 'hsl(142, 71%, 35%)' }}></div>
                  <span>Receitas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{
                    backgroundColor: 'hsl(142, 71%, 60%)'
                  }}></div>
                  <span>{isMobile ? 'Rec. (Proj.)' : 'Receitas (Proj.)'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{ backgroundColor: 'hsl(0, 84%, 50%)' }}></div>
                  <span>Despesas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{
                    backgroundColor: 'hsl(0, 84%, 75%)'
                  }}></div>
                  <span>{isMobile ? 'Desp. (Proj.)' : 'Despesas (Proj.)'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3' : 'w-4'} h-1 rounded`} style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
                  <span>{isMobile ? 'Saldo' : 'Saldo Acumulado'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3' : 'w-4'} h-1 rounded`} style={{
                    background: 'repeating-linear-gradient(to right, hsl(var(--primary)) 0px, hsl(var(--primary)) 3px, transparent 3px, transparent 6px)',
                    backgroundColor: 'transparent'
                  }}></div>
                  <span>{isMobile ? 'Saldo (Proj.)' : 'Saldo Acumulado (Proj.)'}</span>
                </div>
              </div>
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

