'use client';

import { ReferenceArea } from 'recharts';

interface CurrentMonthBackgroundProps {
  data: any[];
  xAxisDataKey: string;
  currentMonthIndex: number;
}

/**
 * Componente que renderiza uma barra azul transparente de fundo
 * para destacar o mês corrente no gráfico
 * Usa ReferenceArea do Recharts para criar uma área vertical destacada
 */
export function CurrentMonthBackground({
  data,
  xAxisDataKey,
  currentMonthIndex,
}: CurrentMonthBackgroundProps) {
  if (currentMonthIndex < 0 || currentMonthIndex >= data.length) {
    return null;
  }

  const currentMonthValue = data[currentMonthIndex]?.[xAxisDataKey];
  
  if (currentMonthValue === undefined || currentMonthValue === null) {
    return null;
  }

  // ReferenceArea precisa de x1 e x2 iguais para criar uma linha vertical
  // e y1/y2 para definir a altura (usaremos valores extremos para cobrir toda a altura)
  return (
    <ReferenceArea
      x1={currentMonthValue}
      x2={currentMonthValue}
      y1={0}
      y2="dataMax"
      fill="hsl(var(--primary))"
      fillOpacity={0.1}
      stroke="none"
      ifOverflow="extendDomain"
    />
  );
}

