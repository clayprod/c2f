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
import { formatMonthYear } from '@/lib/utils';

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
    // Separar acumuladores para histórico (Real) e projetado (Planejado)
    let cumulativeBalanceHistorical = 0;
    let cumulativeBalanceProjected = 0;

    if (selectedHistorical.length > 0) {
      // Começar do saldo acumulado do último mês histórico (antes do início do gráfico visível)
      // Ajuste: precisamos pegar o saldo "real" acumulado até o início do período
      // Para simplificar, assumimos que o primeiro item visível já traz o saldo correto no seu 'cumulativeBalance'
      // Se não, teríamos que calcular desde o início dos tempos.
      // Vamos confiar que 'processedData' já calculou o 'runningBalance' corretamente até aquele ponto.

      const startBalance = selectedHistorical[0].cumulativeBalance - (selectedHistorical[0].income - selectedHistorical[0].expenses);
      cumulativeBalanceHistorical = startBalance;
      cumulativeBalanceProjected = startBalance; // Assumimos que começam iguais no início do período visível
    }

    const finalData = reorganizedData.map((item, index) => {
      const isCurrentMonth = index === selectedHistorical.length;
      const isProjected = index > selectedHistorical.length;


      if (isProjected) {
        // Para meses futuros, sempre usar projeção
        cumulativeBalanceProjected += item.income - item.expenses;
        // Não atualizamos cumulativeBalanceHistorical
      } else {
        // Para meses históricos ou mês corrente

        // Calcular saldo real usando dados reais se disponíveis
        const incomeActual = item.income_actual !== undefined ? item.income_actual : item.income;
        const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : item.expenses;
        cumulativeBalanceHistorical += incomeActual - expensesActual;

        // Calcular saldo projetado (para comparação ou continuidade)
        // Se tiver income_planned/expenses_planned, usamos eles, senão usamos o valor base
        const incomeProjected = item.income_planned !== undefined ? item.income_planned : item.income;
        const expensesProjected = item.expenses_planned !== undefined ? item.expenses_planned : item.expenses;

        // Se for mês corrente, precisamos de um ponto de partida diferente para o projetado?
        // Geralmente a projeção é "desde o início", mas aqui queremos comparar "Realizado até agora" vs "Planejado até agora"
        // OU queremos que a projeção do mês corrente parta do saldo do mês anterior?
        // Simplificação: cumulativeBalanceProjected segue a lógica de planejado
        cumulativeBalanceProjected += incomeProjected - expensesProjected;
      }

      // Linha sólida (histórica) deve parar no mês corrente
      // Se for mês corrente com valores reais, incluir na linha sólida
      const shouldIncludeInHistorical = !isProjected || (isCurrentMonth && !item.isProjected);

      // Para criar continuidade visual na linha projetada se ela começar depois da histórica
      // Mas com a nova lógica de cálculo separado, elas podem divergir, o que é CORRETO/DESEJADO.

      return {
        ...item,
        isProjected: isProjected && !isCurrentMonth,
        // Não usamos mais um único "cumulativeBalance", mas dois separados
        cumulativeBalance: cumulativeBalanceHistorical, // Campo legado se for necessário

        cumulativeBalanceHistorical: shouldIncludeInHistorical ? cumulativeBalanceHistorical : null,

        // Mostrar linha projetada para o mês corrente também, se quisermos comparar
        // Ou apenas para o futuro. 
        // Se quisermos continuidade, o primeiro ponto projetado deve se alinhar com o último histórico? 
        // NÃO, se os valores estão incorretos, queremos ver a divergência.
        cumulativeBalanceProjected: isProjected || isCurrentMonth ? cumulativeBalanceProjected : null,
      };
    });

    // Ajuste fino: Se quisermos que a linha projetada "nasça" da histórica no último mês fechado
    // podemos forçar o valor inicial, mas isso esconde o erro de planejamento acumulado.
    // Vamos manter linhas separadas para honestidade dos dados.

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
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
        <ComposedChart
          data={chartData}
          margin={isMobile
            ? { top: 10, right: 10, left: 0, bottom: 50 }
            : { top: 20, right: 30, left: 20, bottom: 60 }
          }
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
                  fill={shouldBeSolid ? "hsl(142, 71%, 45%)" : "transparent"}
                  stroke={"hsl(142, 71%, 45%)"}
                  strokeWidth={shouldBeSolid ? 0 : 2}
                  strokeOpacity={shouldBeSolid ? 1 : 0.6}
                  strokeDasharray="0"
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
                  fill={shouldBeSolid ? "hsl(0, 84%, 60%)" : "transparent"}
                  stroke={"hsl(0, 84%, 60%)"}
                  strokeWidth={shouldBeSolid ? 0 : 2}
                  strokeOpacity={shouldBeSolid ? 1 : 0.6}
                  strokeDasharray="0"
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

          {/* Legenda customizada mais clara */}
          <Legend
            wrapperStyle={{ paddingTop: isMobile ? '10px' : '20px' }}
            content={() => (
              <div className={`flex items-center justify-center flex-wrap ${isMobile ? 'gap-x-3 gap-y-1.5 text-xs px-2' : 'gap-6 text-sm'}`}>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{ backgroundColor: 'hsl(142, 71%, 45%)' }}></div>
                  <span>Receitas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{
                    border: '2px solid hsl(142, 71%, 45%)',
                    opacity: 0.6,
                    backgroundColor: 'transparent'
                  }}></div>
                  <span>{isMobile ? 'Rec. (Proj.)' : 'Receitas (Proj.)'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
                  <span>Despesas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded`} style={{
                    border: '2px solid hsl(0, 84%, 60%)',
                    opacity: 0.6,
                    backgroundColor: 'transparent'
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

