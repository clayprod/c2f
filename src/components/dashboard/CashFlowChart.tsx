'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Bar,
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
}

export function CashFlowChart({ data, periodCount = 12, groupBy = 'month' }: CashFlowChartProps) {
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

  const { chartData, currentMonthIndex } = useMemo(() => {
    // Primeiro, processar e formatar os dados
    let runningBalance = 0;
    const processedData = data.map((item, index) => {
      runningBalance += item.income - item.expenses;
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
        cumulativeBalance: runningBalance,
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

    // Reorganizar dados para centralizar mês corrente (com offset de navegação)
    // Dividir em histórico (antes do mês corrente) e projeção (depois)
    const historicalData = processedData.slice(0, finalCurrentMonthIndex);
    const currentMonthData = processedData[finalCurrentMonthIndex] ? [processedData[finalCurrentMonthIndex]] : [];
    const projectedData = processedData.slice(finalCurrentMonthIndex + 1);

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

    // Recalcular saldo acumulado para manter continuidade
    // A linha projetada deve partir do saldo real do mês anterior
    // somando o delta projetado do mês corrente
    let cumulativeBalanceHistorical = 0;

    if (selectedHistorical.length > 0) {
      // Começar do saldo acumulado do último mês histórico (antes do início do gráfico visível)
      const startBalance = selectedHistorical[0].cumulativeBalance - (selectedHistorical[0].income - selectedHistorical[0].expenses);
      cumulativeBalanceHistorical = startBalance;
    }

    // Primeira passada: calcular apenas o saldo histórico até o mês corrente
    let lastHistoricalBalance = cumulativeBalanceHistorical;
    let balanceBeforeCurrentMonth = cumulativeBalanceHistorical;
    const tempData = reorganizedData.map((item, index) => {
      const isCurrentMonth = index === selectedHistorical.length;
      const isProjected = index > selectedHistorical.length;

      if (!isProjected) {
        // Para meses históricos ou mês corrente, calcular saldo real
        const incomeActual = item.income_actual !== undefined ? item.income_actual : item.income;
        const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : item.expenses;
        if (isCurrentMonth) {
          balanceBeforeCurrentMonth = cumulativeBalanceHistorical;
        }
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

    // Segunda passada: calcular o saldo projetado a partir do saldo real do mês anterior
    // somando o delta projetado do mês corrente
    const currentMonthItem = tempData[selectedHistorical.length];
    const currentIncomePlanned = currentMonthItem?.income_planned !== undefined
      ? currentMonthItem.income_planned
      : currentMonthItem?.income;
    const currentExpensesPlanned = currentMonthItem?.expenses_planned !== undefined
      ? currentMonthItem.expenses_planned
      : currentMonthItem?.expenses;
    const currentProjectedDelta = (currentIncomePlanned ?? 0) - (currentExpensesPlanned ?? 0);
    const projectedStartBalance = currentMonthItem
      ? balanceBeforeCurrentMonth + currentProjectedDelta
      : lastHistoricalBalance;

    let cumulativeBalanceProjected = projectedStartBalance;
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

      // Para períodos agrupados (trimestre/ano) ou mês atual:
      // Sempre mostrar valores consolidados de realizados E projetados
      // Para meses passados: só mostrar realizados
      // Para meses futuros: só mostrar projetados
      
      // Valores realizados (actual)
      const incomeActual = item.income_actual !== undefined ? item.income_actual : 0;
      const expensesActual = item.expenses_actual !== undefined ? item.expenses_actual : 0;
      
      // Valores projetados (planned)
      const incomePlanned = item.income_planned !== undefined ? item.income_planned : 0;
      const expensesPlanned = item.expenses_planned !== undefined ? item.expenses_planned : 0;
      
      // Lógica para mostrar barras:
      // - Meses passados (não projetados, não atual): só realizados
      // - Mês/período atual: ambos (realizados e projetados)
      // - Meses futuros (projetados): só projetados
      // - Para groupBy !== 'month': sempre mostrar ambos se tiverem valor > 0
      
      let income_real: number | null = null;
      let income_proj: number | null = null;
      let expenses_real: number | null = null;
      let expenses_proj: number | null = null;
      
      if (groupBy !== 'month') {
        // Para trimestre/ano: sempre mostrar o consolidado de ambos
        income_real = incomeActual > 0 ? incomeActual : null;
        income_proj = incomePlanned > 0 ? incomePlanned : null;
        expenses_real = expensesActual > 0 ? expensesActual : null;
        expenses_proj = expensesPlanned > 0 ? expensesPlanned : null;
      } else {
        // Para mês: lógica original
        if (isProjected) {
          // Mês futuro: só projetados
          income_proj = incomePlanned > 0 ? incomePlanned : (item.income > 0 ? item.income : null);
          expenses_proj = expensesPlanned > 0 ? expensesPlanned : (item.expenses > 0 ? item.expenses : null);
        } else if (isCurrentMonth) {
          // Mês atual: ambos
          income_real = incomeActual > 0 ? incomeActual : null;
          income_proj = incomePlanned > 0 ? incomePlanned : null;
          expenses_real = expensesActual > 0 ? expensesActual : null;
          expenses_proj = expensesPlanned > 0 ? expensesPlanned : null;
        } else {
          // Mês passado: só realizados
          income_real = incomeActual > 0 ? incomeActual : (item.income > 0 ? item.income : null);
          expenses_real = expensesActual > 0 ? expensesActual : (item.expenses > 0 ? item.expenses : null);
        }
      }

      // Flags para indicar quando há sobreposição (valores reais e projetados no mesmo período)
      const hasIncomeOverlap = income_real !== null && income_proj !== null;
      const hasExpensesOverlap = expenses_real !== null && expenses_proj !== null;
      
      // Valores ajustados (mantidos iguais para simplicidade)
      const income_proj_adjusted = income_proj;
      const expenses_proj_adjusted = expenses_proj;

      return {
        ...item,
        isProjected: isProjected && !isCurrentMonth,
        isCurrentMonth, // Garantir que isCurrentMonth está disponível
        cumulativeBalance: item.cumulativeBalanceHistorical || cumulativeBalanceProjected,
        cumulativeBalanceHistorical: shouldIncludeInHistorical ? item.cumulativeBalanceHistorical : null,
        // No mês corrente, a linha projetada começa no saldo do mês anterior
        // somado ao delta projetado do mês
        // Nos meses futuros, continua com as projeções somadas
        cumulativeBalanceProjected: shouldIncludeInProjected
          ? (isCurrentMonth ? projectedStartBalance : cumulativeBalanceProjected)
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
  }, [data, periodCount, viewOffset, groupBy]);

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
    <div className="w-full relative overflow-hidden">
      {/* Botões de navegação */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 z-10">
        <button
          onClick={navigateLeft}
          disabled={viewOffset <= minOffset}
          className="p-1.5 rounded-full bg-card/80 backdrop-blur border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Ver meses anteriores"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-0 z-10">
        <button
          onClick={navigateRight}
          disabled={viewOffset >= maxOffset}
          className="p-1.5 rounded-full bg-card/80 backdrop-blur border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Ver meses futuros"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {/* Container do gráfico com suporte a arraste */}
      <div
        ref={containerRef}
        className="cursor-grab select-none"
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
              ? { top: 10, right: 30, left: 10, bottom: 50 }
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
                  fontSize={12}
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
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
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

          {/* Barras de Receitas Projetadas (background - translúcidas) */}
          <Bar
            dataKey="income_proj"
            name="Receitas Proj."
            fill={chartIncomeColor}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            fillOpacity={0.35}
          />
          
          {/* Barras de Receitas Realizadas (foreground - sólidas, sobrepostas) */}
          <Bar
            dataKey="income_real"
            name="Receitas"
            fill={chartIncomeColor}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />

          {/* Barras de Despesas Projetadas (background - translúcidas) */}
          <Bar
            dataKey="expenses_proj"
            name="Despesas Proj."
            fill={chartExpenseColor}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            fillOpacity={0.35}
          />
          
          {/* Barras de Despesas Realizadas (foreground - sólidas) */}
          <Bar
            dataKey="expenses_real"
            name="Despesas"
            fill={chartExpenseColor}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
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
              strokeWidth: 2,
              r: 5,
            }}
            activeDot={{
              fill: chartBalanceColor,
              strokeWidth: 2,
              r: 7,
            }}
            connectNulls={false}
          />

          {/* Linha de Saldo Projetado (tracejada) */}
          <Line
            type="monotone"
            dataKey="cumulativeBalanceProjected"
            name="Saldo Projetado"
            stroke={chartBalanceColor}
            strokeWidth={3}
            strokeDasharray="8 4"
            dot={{
              fill: 'hsl(var(--background))',
              stroke: chartBalanceColor,
              strokeWidth: 2,
              r: 5,
            }}
            activeDot={{
              fill: chartBalanceColor,
              strokeWidth: 2,
              r: 7,
            }}
            connectNulls={false}
          />

          {/* Legenda customizada */}
          <Legend
            wrapperStyle={{ paddingTop: isMobile ? '10px' : '20px' }}
            content={() => (
              <div className={`flex items-center justify-center flex-wrap ${isMobile ? 'gap-x-3 gap-y-1.5 text-[10px] px-1' : 'gap-x-6 gap-y-2 text-sm'}`}>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: chartIncomeColor }}></div>
                  <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Receitas' : 'Receitas Realizadas'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm opacity-40 flex-shrink-0" style={{ backgroundColor: chartIncomeColor }}></div>
                  <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Receitas Proj.' : 'Receitas Projetadas'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: chartExpenseColor }}></div>
                  <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Despesas' : 'Despesas Realizadas'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm opacity-40 flex-shrink-0" style={{ backgroundColor: chartExpenseColor }}></div>
                  <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Despesas Proj.' : 'Despesas Projetadas'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-0.5 w-4 flex-shrink-0" style={{ backgroundColor: chartBalanceColor }}></div>
                  <span className="text-muted-foreground whitespace-nowrap">{isMobile ? 'Saldo' : 'Saldo Realizado'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-0.5 w-4 border-t-2 border-dashed flex-shrink-0" style={{ borderColor: chartBalanceColor }}></div>
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

