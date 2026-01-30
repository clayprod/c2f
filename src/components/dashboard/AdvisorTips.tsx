'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InfoIcon } from '@/components/ui/InfoIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdvisorInsight {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

interface AdvisorAction {
  type: string;
  description?: string;
  payload: Record<string, any>;
  confidence: 'low' | 'medium' | 'high';
}

interface TipResponse {
  summary: string;
  insights: AdvisorInsight[];
  actions: AdvisorAction[];
  confidence: 'low' | 'medium' | 'high';
  isNew?: boolean;
  cached?: boolean;
}

const severityColors = {
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

const severityIcons = {
  low: 'bx-info-circle',
  medium: 'bx-error',
  high: 'bx-error-circle',
};

const confidenceColors = {
  low: 'bg-slate-500/10 text-slate-600',
  medium: 'bg-emerald-500/10 text-emerald-600',
  high: 'bg-success/10 text-success',
};

export function AdvisorTips() {
  const [expanded, setExpanded] = useState(false);

  const { data: tip, isLoading, error, refetch, isRefetching } = useQuery<TipResponse>({
    queryKey: ['advisor-tips'],
    queryFn: async () => {
      const res = await fetch('/api/advisor/tips');
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao carregar dica');
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    );
  }

  if (error || !tip) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <i className="bx bx-sparkles text-2xl text-secondary animate-pulse"></i>
          <h2 className="font-display font-semibold">Dica do Dia</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          {error instanceof Error ? error.message : 'Não foi possível carregar a dica do dia.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <>
              <i className="bx bx-loader-alt animate-spin mr-2"></i>
              Carregando...
            </>
          ) : (
            <>
              <i className="bx bx-repeat mr-2"></i>
              Tentar novamente
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-6 animate-slide-in-up delay-300 overflow-hidden w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 min-w-0 w-full overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <i className="bx bx-sparkles text-2xl text-secondary animate-pulse-soft flex-shrink-0"></i>
          <h2 className="font-display font-semibold text-sm md:text-base truncate">Dica do Dia</h2>
          {tip.isNew && (
            <span className="px-2 py-0.5 text-[10px] md:text-xs font-medium rounded-full bg-success/10 text-success border border-success/20 flex-shrink-0">
              Nova
            </span>
          )}
          <div className="flex-shrink-0">
            <InfoIcon
              content={
                <div className="space-y-2">
                  <p className="font-semibold">Sobre as Dicas:</p>
                  <ul className="space-y-1.5 text-xs list-disc list-inside">
                    <li>Dicas são geradas diariamente com base nos seus dados financeiros.</li>
                    <li>A IA analisa seus gastos, orçamentos, metas e dívidas.</li>
                    <li>Insights ajudam a identificar padrões e oportunidades.</li>
                    <li>Ações sugeridas são passos concretos que você pode tomar.</li>
                  </ul>
                </div>
              }
            />
          </div>
        </div>
        <span className={cn(
          'px-2 py-0.5 text-[10px] md:text-xs font-medium rounded-full whitespace-nowrap self-start sm:self-center flex-shrink-0',
          confidenceColors[tip.confidence]
        )}>
          {tip.confidence === 'high' ? 'Alta' : tip.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
        </span>
      </div>

      {/* Summary */}
      <p className="text-foreground mb-4 text-sm md:text-base break-words leading-relaxed">{tip.summary}</p>

      {/* Insights */}
      {tip.insights && tip.insights.length > 0 && (
        <div className="mb-4 overflow-x-auto scrollbar-hide w-full">
          <div className="flex flex-nowrap sm:flex-wrap gap-2 animate-children-stagger pb-1 min-w-0">
            {tip.insights.slice(0, expanded ? undefined : 3).map((insight, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] md:text-xs font-medium border transition-all duration-300 hover:scale-105 flex-shrink-0',
                  severityColors[insight.severity]
                )}
              >
                <i className={cn('bx', severityIcons[insight.severity])}></i>
                <span className="max-w-[120px] sm:max-w-[180px] truncate" title={insight.message}>
                  {insight.message}
                </span>
              </div>
            ))}
            {!expanded && tip.insights.length > 3 && (
              <button
                onClick={() => setExpanded(true)}
                className="px-3 py-1.5 rounded-full text-[10px] md:text-xs font-medium bg-muted hover:bg-muted/80 transition-colors flex-shrink-0"
              >
                +{tip.insights.length - 3} mais
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {tip.actions && tip.actions.length > 0 && (
        <div className={cn(!expanded && 'hidden', "w-full min-w-0")}>
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <i className="bx bx-target-lock animate-pulse-soft"></i>
            Ações Sugeridas
          </p>
          <div className="space-y-2 animate-children-stagger w-full min-w-0">
            {tip.actions.map((action, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 rounded-lg bg-card/50 border border-border hover-lift transition-all duration-300 w-full min-w-0 overflow-hidden"
              >
                <i className="bx bx-right-arrow-alt text-primary mt-0.5 flex-shrink-0"></i>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm break-words leading-snug">{action.description || action.type}</p>
                  <span className={cn(
                    'inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full',
                    confidenceColors[action.confidence]
                  )}>
                    {action.confidence === 'high' ? 'Recomendado' : action.confidence === 'medium' ? 'Sugerido' : 'Opcional'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand/Collapse button */}
      {(tip.insights.length > 3 || tip.actions.length > 0) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="group mt-4 text-sm text-primary flex items-center gap-1"
        >
          <i className={cn('bx', expanded ? 'bx-chevron-up' : 'bx-chevron-down')}></i>
          <span className="group-hover:underline decoration-skip-ink-none">
            {expanded ? 'Ver menos' : 'Ver mais detalhes'}
          </span>
        </button>
      )}
    </div>
  );
}
