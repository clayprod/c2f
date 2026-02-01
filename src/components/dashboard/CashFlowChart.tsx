'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceArea,
} from 'recharts';
import { formatMonthYear } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

type GroupByType = 'month' | 'quarter' | 'year';

interface PeriodData {
  month: string;        // period key (YYYY-MM, YYYY-QX, or YYYY)
  monthLabel: string;   // formatted label
  income: number;
  expenses: number;
  balance: number;
  isCurrentMonth: boolean;  // isCurrentPeriod
  isProjected: boolean;
  income_actual?: number;
  income_planned?: number;
  expenses_actual?: number;
  expenses_planned?: number;
}

interface CashFlowChartProps {
  data: PeriodData[];
  periodCount?: number;
  groupBy?: GroupByType;
  currentBalance?: number;
}

export function CashFlowChart({ data, periodCount = 12, groupBy = 'month', currentBalance }: CashFlowChartProps) {
  const isMobile = useIsMobile();

  // Estado para navegação por arraste
  const [viewOffset, setViewOffset] = useState(0); // Offset em meses (negativo = passado, positivo = futuro)
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);

  // Cores usando variáveis CSS do tema
  const chartIncomeColor = 'hsl(var(--chart-income))';
  const chartExpenseColor = 'hsl(var(--chart-expense))';
  const chartBalanceColor = 'hsl(var(--chart-balance))';

  // Calcular limites de navegação baseado nos dados históricos e projetados
  const { minOffset, maxOffset } = useMemo(() => {
    const currentMonthIdx = data.findIndex(d => d.isCurrentMonth);
    if (currentMonthIdx < 0) {
      return { minOffset: 0, maxOffset: 0 };
    }

    const halfPeriod = Math.floor(periodCount / 2);
    const historicalCount = currentMonthIdx; // meses antes do atual
    const projectedCount = data.length - currentMonthIdx - 1; // meses depois do atual

    // minOffset: quanto pode ir para o passado (valor negativo)
    // Se tiver mais histórico que metade do período, pode navegar para o passado
    const canGoBack = Math.max(0, historicalCount - halfPeriod);

    // maxOffset: quanto pode ir para o futuro (valor positivo)
    // Se tiver mais projeção que metade do período, pode navegar para o futuro
    const canGoForward = Math.max(0, projectedCount - halfPeriod);

    return {
      minOffset: -canGoBack,
      maxOffset: canGoForward
    };
  }, [data, periodCount]);

  // Handlers para navegação por arraste
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartOffset.current = viewOffset;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, [viewOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - dragStartX.current;
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const monthWidth = containerWidth / periodCount;
    const monthsDelta = Math.round(-deltaX / monthWidth);

    const newOffset = Math.max(minOffset, Math.min(maxOffset, dragStartOffset.current + monthsDelta));
    setViewOffset(newOffset);
  }, [periodCount, minOffset, maxOffset]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    }
  }, []);

  // Handlers para touch (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartX.current = e.touches[0].clientX;
    dragStartOffset.current = viewOffset;
  }, [viewOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.touches[0].clientX - dragStartX.current;
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const monthWidth = containerWidth / periodCount;
    const monthsDelta = Math.round(-deltaX / monthWidth);

    const newOffset = Math.max(minOffset, Math.min(maxOffset, dragStartOffset.current + monthsDelta));
    setViewOffset(newOffset);
  }, [periodCount, minOffset, maxOffset]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Navegação por botões
  const navigateLeft = useCallback(() => {
    setViewOffset(prev => Math.max(minOffset, prev - 1));
  }, [minOffset]);

  const navigateRight = useCallback(() => {
    setViewOffset(prev => Math.min(maxOffset, prev + 1));
  }, [maxOffset]);

  // Resetar offset quando periodCount ou groupBy mudar
  useEffect(() => {
    setViewOffset(0);
  }, [periodCount, groupBy]);

  const { chartData, currentMonthIndex, hasProjections } = useMemo(() => {
    console.log('[CashFlowChart] Processing data, items:', data.length, 'groupBy:', groupBy);
    if (data.length > 0) {
      console.log('[CashFlowChart] First item:', data[0]);
      const currentItem = data.find(d => d.isCurrentMonth);
      console.log('[CashFlowChart] Current period item:', currentItem?.month || 'NOT FOUND');
    }

    // Primeiro, processar e formatar os dados
    const processedData = data.map((item) => {
      // Usar o monthLabel já formatado (vem da página)
      // Só formatar com formatMonthYear se for formato de mês (YYYY-MM) e groupBy === 'month'
      let formattedMonthLabel = item.monthLabel;
      let isCurrentMonth = item.isCurrentMonth;

      if (groupBy === 'month' && item.month && /^\d{4}-\d{2}$/.test(item.month)) {
        // Se month está no formato YYYY-MM, formatar
        const monthInfoResult = formatMonthYear(item.month, { returnCurrentMonthInfo: true });
        formattedMonthLabel = typeof monthInfoResult === 'string' ? monthInfoResult : monthInfoResult.formatted;
        isCurrentMonth = typeof monthInfoResult === 'object' ? monthInfoResult.isCurrentMonth : false;
      }

      return {
        ...item,
        monthLabel: formattedMonthLabel,
        isCurrentMonth,
        balanceDashArray: item.isProjected ? '5 5' : '0',
      };
    });

    // Encontrar índice do mês corrente
    const currentMonthIdx = processedData.findIndex(d => d.isCurrentMonth);

    // Se não encontrou mês corrente, usar o último mês histórico
    const finalCurrentMonthIndex = currentMonthIdx >= 0 ? currentMonthIdx : processedData.findIndex(d => !d.isProjected);

    const baseBalance = typeof currentBalance === 'number' ? currentBalance : 0;

    if (finalCurrentMonthIndex < 0) {
      // Se não encontrou nenhum mês, retornar dados originais
      let cumulative = baseBalance;
      return {
        chartData: processedData.map((item) => {
          const incomeActual = item.income_actual !== undefined ? item.income_actual : (!item.isProjected ? item.income : 0);
          const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : (!item.isProjected ? item.expenses : 0);
          if (!item.isProjected) {
            cumulative += (incomeActual || 0) - (expensesActual || 0);
          }

          const incomePlanned = item.income_planned !== undefined ? item.income_planned : (item.isProjected ? item.income : null);
          const expensesPlanned = item.expenses_planned !== undefined ? item.expenses_planned : (item.isProjected ? item.expenses : null);

          return {
            ...item,
            cumulativeBalanceHistorical: !item.isProjected ? cumulative : null,
            cumulativeBalanceProjected: null,
            income_real: (!item.isProjected && incomeActual !== null) ? incomeActual : null,
            income_proj: (item.isProjected && incomePlanned !== null) ? incomePlanned : null,
            expenses_real: (!item.isProjected && expensesActual !== null) ? expensesActual : null,
            expenses_proj: (item.isProjected && expensesPlanned !== null) ? expensesPlanned : null,
          };
        }),
        currentMonthIndex: 0,
        hasProjections: false,
      };
    }

    const actualDeltas = processedData.map((item) => {
      const incomeActual = item.income_actual !== undefined ? item.income_actual : (!item.isProjected ? item.income : 0);
      const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : (!item.isProjected ? item.expenses : 0);
      return (incomeActual || 0) - (expensesActual || 0);
    });

    const totalActualToCurrent = actualDeltas
      .slice(0, finalCurrentMonthIndex + 1)
      .reduce((sum, delta) => sum + delta, 0);
    const startBalance = baseBalance - totalActualToCurrent;

    let cumulativeActual = startBalance;
    const dataWithBalances = processedData.map((item, index) => {
      if (index <= finalCurrentMonthIndex) {
        cumulativeActual += actualDeltas[index];
        return {
          ...item,
          cumulativeBalanceHistorical: cumulativeActual,
        };
      }
      return {
        ...item,
        cumulativeBalanceHistorical: null,
      };
    });

    const hasProjectionValues = dataWithBalances
      .slice(finalCurrentMonthIndex)
      .some((item) => (item.income_planned || 0) > 0 || (item.expenses_planned || 0) > 0);

    // Reorganizar dados para centralizar mês corrente (com offset de navegação)
    // Dividir em histórico (antes do mês corrente) e projeção (depois)
    const historicalData = dataWithBalances.slice(0, finalCurrentMonthIndex);
    const currentMonthData = dataWithBalances[finalCurrentMonthIndex] ? [dataWithBalances[finalCurrentMonthIndex]] : [];
    const projectedData = dataWithBalances.slice(finalCurrentMonthIndex + 1);

    // Calcular quantos meses mostrar antes e depois do mês corrente
    // viewOffset desloca a janela de visualização (positivo = mais futuro, negativo = mais passado)
    const halfPeriod = Math.floor(periodCount / 2);
    const adjustedMonthsBefore = Math.max(0, halfPeriod - viewOffset);
    const adjustedMonthsAfter = Math.max(0, halfPeriod + viewOffset);

    const monthsBefore = Math.min(adjustedMonthsBefore, historicalData.length);
    const monthsAfter = Math.min(adjustedMonthsAfter, projectedData.length);

    // Pegar últimos N meses históricos e primeiros N meses projetados
    const selectedHistorical = historicalData.slice(-monthsBefore);
    const selectedProjected = projectedData.slice(0, monthsAfter);

    // Combinar: histórico + mês corrente + projeção
    const reorganizedData = [
      ...selectedHistorical,
      ...currentMonthData,
      ...selectedProjected,
    ];

    // Definir mês corrente e projeções
    const tempData = reorganizedData.map((item, index) => {
      const isCurrentMonth = index === selectedHistorical.length;
      const isProjected = index > selectedHistorical.length;

      return {
        ...item,
        isCurrentMonth,
        isProjectedMonth: isProjected,
      };
    });

    const currentMonthItem = tempData[selectedHistorical.length];
    const projectedStartBalance = currentMonthItem?.cumulativeBalanceHistorical ?? baseBalance;

    let cumulativeBalanceProjected = projectedStartBalance;
    const finalData = tempData.map((item) => {
      const isCurrentMonth = item.isCurrentMonth;
      const isProjected = item.isProjectedMonth;

      const incomePlanned = item.income_planned ?? 0;
      const expensesPlanned = item.expenses_planned ?? 0;

      if (hasProjectionValues) {
        if (isCurrentMonth) {
          cumulativeBalanceProjected = projectedStartBalance + (incomePlanned - expensesPlanned);
        } else if (isProjected) {
          cumulativeBalanceProjected += incomePlanned - expensesPlanned;
        }
      }

      // Linha sólida (histórica) deve parar no mês corrente
      const shouldIncludeInHistorical = !isProjected;

      // A linha projetada começa no mês corrente (mesmo valor do histórico)
      // e continua nos meses futuros
      const shouldIncludeInProjected = hasProjectionValues && (isCurrentMonth || isProjected);

      // Valores realizados (actual)
      const incomeActual = item.income_actual !== undefined ? item.income_actual : 0;
      const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : 0;

      // Valores projetados (planned)
      // Lógica para mostrar barras:
      // - Meses passados (não projetados, não atual): só realizados
      // - Mês/período atual: ambos (realizados e projetados)
      // - Meses futuros (projetados): só projetados
      // - Para groupBy !== 'month': mostrar consolidado baseado no período

      let income_real: number | null = null;
      let income_proj: number | null = null;
      let expenses_real: number | null = null;
      let expenses_proj: number | null = null;

      if (isProjected) {
        // Período futuro: só projetados
        income_proj = incomePlanned > 0 ? incomePlanned : (item.income > 0 ? item.income : null);
        expenses_proj = expensesPlanned > 0 ? expensesPlanned : (item.expenses > 0 ? item.expenses : null);
      } else if (isCurrentMonth) {
        // Período atual: ambos
        income_real = incomeActual > 0 ? incomeActual : null;
        income_proj = incomePlanned > 0 ? incomePlanned : null;
        expenses_real = expensesActual > 0 ? expensesActual : null;
        expenses_proj = expensesPlanned > 0 ? expensesPlanned : null;
      } else {
        // Período passado: só realizados
        income_real = incomeActual > 0 ? incomeActual : (item.income > 0 ? item.income : null);
        expenses_real = expensesActual > 0 ? expensesActual : (item.expenses > 0 ? item.expenses : null);
      }

      // Flags para indicar quando há sobreposição (valores reais e projetados no mesmo período)
      const hasIncomeOverlap = income_real !== null && income_proj !== null;
      const hasExpensesOverlap = expenses_real !== null && expenses_proj !== null;

      // Valores ajustados (mantidos iguais para simplicidade)
      const income_proj_adjusted = hasProjectionValues ? income_proj : null;
      const expenses_proj_adjusted = hasProjectionValues ? expenses_proj : null;

      return {
        ...item,
        isProjected: isProjected && !isCurrentMonth,
        isCurrentMonth, // Garantir que isCurrentMonth está disponível
        cumulativeBalance: item.cumulativeBalanceHistorical ?? cumulativeBalanceProjected,
        cumulativeBalanceHistorical: shouldIncludeInHistorical ? item.cumulativeBalanceHistorical : null,
        // No mês corrente, a linha projetada começa no saldo real do mês corrente
        // Nos meses futuros, continua com as projeções somadas
        cumulativeBalanceProjected: shouldIncludeInProjected
          ? cumulativeBalanceProjected
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
      hasProjections: hasProjectionValues,
    };
  }, [data, periodCount, viewOffset, groupBy, currentBalance]);

  // Formatação compacta para gráficos (sem centavos)
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
      const dataPoint = payload[0]?.payload;
      const isCurrent = dataPoint?.isCurrentMonth;
      const isProjected = dataPoint?.isProjected;

      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-xl">
          <p className="mb-2 font-medium text-foreground">
            {label}{' '}
            {isCurrent && (
              <span className="text-primary">
                ({groupBy === 'month' ? 'Mês Atual' : groupBy === 'quarter' ? 'Trimestre Atual' : 'Ano Atual'})
              </span>
            )}
            {isProjected && <span className="text-muted-foreground">(Projetado)</span>}
          </p>
          {payload
            .filter((entry: any) => entry.value !== null)
            .map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(entry.value)}
                </span>
              </div>
            ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full relative overflow-hidden min-w-0">
      {/* Botões de navegação */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 z-10">
        <button
          onClick={navigateLeft}
          disabled={viewOffset <= minOffset}
          className="p-1 rounded bg-card/80 backdrop-blur border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Ver meses anteriores"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-0 z-10">
        <button
          onClick={navigateRight}
          disabled={viewOffset >= maxOffset}
          className="p-1 rounded bg-card/80 backdrop-blur border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Ver meses futuros"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Container do gráfico com suporte a arraste */}
      <div
        ref={containerRef}
        className="cursor-grab select-none overflow-hidden w-full min-w-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
          <ComposedChart
            data={chartData}
            margin={isMobile
              ? { top: 10, right: 10, left: -20, bottom: 50 }
              : { top: 20, right: 50, left: 40, bottom: 5 }
            }
            barGap={-40}
            barCategoryGap="20%"
          >

            {/* Grid sutil */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis
              dataKey="monthLabel"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload }: any) => {
                const dataPoint = chartData.find(d => d.monthLabel === payload.value);
                const isCurrent = dataPoint?.isCurrentMonth;
                return (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fill={isCurrent ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    fontSize={isMobile ? 10 : 12}
                    fontWeight={isCurrent ? 600 : 400}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 10 : 12 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              width={isMobile ? 40 : 60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Destaque do mês atual */}
            {currentMonthIndex >= 0 && currentMonthIndex < chartData.length && (() => {
              const currentMonthValue = chartData[currentMonthIndex]?.monthLabel;
              if (!currentMonthValue) return null;
              return (
                <ReferenceArea
                  x1={currentMonthValue}
                  x2={currentMonthValue}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.08}
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.3}
                  strokeDasharray="4 2"
                />
              );
            })()}

            {/* Linha de Receitas Realizadas */}
            <Line
              type="monotone"
              dataKey="income_real"
              name="Receitas"
              stroke={chartIncomeColor}
              strokeWidth={2}
              dot={{ r: 5, fill: chartIncomeColor, strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />

            {/* Linha de Receitas Projetadas */}
            <Line
              type="monotone"
              dataKey="income_proj"
              name="Receitas Proj."
              stroke={chartIncomeColor}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.5}
              dot={{ r: 5, fill: chartIncomeColor, strokeWidth: 0, fillOpacity: 0.5 }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />

            {/* Linha de Despesas Realizadas */}
            <Line
              type="monotone"
              dataKey="expenses_real"
              name="Despesas"
              stroke={chartExpenseColor}
              strokeWidth={2}
              dot={{ r: 5, fill: chartExpenseColor, strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />

            {/* Linha de Despesas Projetadas */}
            <Line
              type="monotone"
              dataKey="expenses_proj"
              name="Despesas Proj."
              stroke={chartExpenseColor}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.5}
              dot={{ r: 5, fill: chartExpenseColor, strokeWidth: 0, fillOpacity: 0.5 }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />

            {/* Linha de Saldo Realizado (sólida) */}
            <Line
              type="monotone"
              dataKey="cumulativeBalanceHistorical"
              name="Saldo"
              stroke={chartBalanceColor}
              strokeWidth={3}
              dot={{
                fill: chartBalanceColor,
                strokeWidth: 0,
                r: 5,
              }}
              activeDot={{
                fill: chartBalanceColor,
                strokeWidth: 0,
                r: 7,
              }}
              connectNulls={false}
            />

            {/* Linha de Saldo Projetado (tracejada) */}
            {hasProjections && (
              <Line
                type="monotone"
                dataKey="cumulativeBalanceProjected"
                name="Saldo Projetado"
                stroke={chartBalanceColor}
                strokeWidth={3}
                strokeDasharray="8 4"
                strokeOpacity={0.5}
                dot={{
                  fill: 'hsl(var(--background))',
                  stroke: chartBalanceColor,
                  strokeWidth: 1,
                  r: 5,
                  fillOpacity: 0.5,
                }}
                activeDot={{
                  fill: chartBalanceColor,
                  strokeWidth: 0,
                  r: 7,
                }}
                connectNulls={false}
              />
            )}

            {/* Legenda customizada */}
            <Legend
              wrapperStyle={{ paddingTop: isMobile ? '10px' : '20px', width: '100%' }}
              content={() => (
                <div className={`flex items-center justify-center flex-wrap w-full ${isMobile ? 'gap-x-2 gap-y-1.5 text-[9px] px-0' : 'gap-x-6 gap-y-2 text-sm'}`}>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: chartIncomeColor }}></div>
                    <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Receitas' : 'Receitas Realizadas'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm opacity-40 flex-shrink-0" style={{ backgroundColor: chartIncomeColor }}></div>
                    <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Receitas Proj.' : 'Receitas Projetadas'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: chartExpenseColor }}></div>
                    <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Despesas' : 'Despesas Realizadas'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm opacity-40 flex-shrink-0" style={{ backgroundColor: chartExpenseColor }}></div>
                    <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Despesas Proj.' : 'Despesas Projetadas'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-0.5 w-3 flex-shrink-0" style={{ backgroundColor: chartBalanceColor }}></div>
                    <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Saldo' : 'Saldo Realizado'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-0.5 w-3 border-t-2 border-dashed flex-shrink-0" style={{ borderColor: chartBalanceColor }}></div>
                    <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Saldo Proj.' : 'Saldo Projetado'}</span>
                  </div>
                </div>
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Indicador de navegação */}
      {(viewOffset !== 0) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => setViewOffset(0)}
            className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            {groupBy === 'month' ? 'Voltar ao mês atual' :
              groupBy === 'quarter' ? 'Voltar ao trimestre atual' :
                'Voltar ao ano atual'}
          </button>
        </div>
      )}
    </div>
  );
}

