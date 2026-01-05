'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { useToast } from '@/hooks/use-toast';

interface ReplicateBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  budgetName: string;
  onSuccess: () => void;
}

export function ReplicateBudgetModal({
  open,
  onOpenChange,
  budgetId,
  budgetName,
  onSuccess,
}: ReplicateBudgetModalProps) {
  const [replicateType, setReplicateType] = useState<'months' | 'date'>('months');
  const [months, setMonths] = useState<number>(12);
  const [endMonth, setEndMonth] = useState<string>('');
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const body: any = {
        budget_id: budgetId,
        overwrite,
      };

      if (replicateType === 'months') {
        if (!months || months < 1) {
          toast({
            title: 'Erro',
            description: 'Número de meses deve ser maior que zero',
            variant: 'destructive',
          });
          return;
        }
        body.months = months;
      } else {
        if (!endMonth) {
          toast({
            title: 'Erro',
            description: 'Selecione uma data final',
            variant: 'destructive',
          });
          return;
        }
        body.end_month = endMonth;
      }

      const res = await fetch('/api/budgets/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao replicar orçamento');
      }

      const result = await res.json();
      const { created, overwritten, skipped } = result.data;

      toast({
        title: 'Sucesso',
        description: `Orçamento replicado: ${created} criados, ${overwritten} sobrescritos, ${skipped} pulados`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePreview = () => {
    if (replicateType === 'months') {
      return months;
    } else if (endMonth) {
      const now = new Date();
      const [endYear, endMonthNum] = endMonth.split('-').map(Number);
      const endDate = new Date(endYear, endMonthNum - 1, 1);
      const monthsDiff = (endDate.getFullYear() - now.getFullYear()) * 12 + 
                         (endDate.getMonth() - now.getMonth());
      return Math.max(0, monthsDiff);
    }
    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replicar Orçamento</DialogTitle>
          <DialogDescription>
            Replicar orçamento "{budgetName}" para vários meses
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Replicação</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={replicateType === 'months' ? 'default' : 'outline'}
                onClick={() => setReplicateType('months')}
                className="flex-1"
              >
                Por Número de Meses
              </Button>
              <Button
                type="button"
                variant={replicateType === 'date' ? 'default' : 'outline'}
                onClick={() => setReplicateType('date')}
                className="flex-1"
              >
                Até Data Específica
              </Button>
            </div>
          </div>

          {replicateType === 'months' ? (
            <div>
              <label className="block text-sm font-medium mb-2">Número de Meses</label>
              <input
                type="number"
                min="1"
                max="60"
                value={months}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setMonths(Math.min(60, Math.max(1, val))); // Limit to 60 months (5 years)
                }}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
                placeholder="12"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo: 60 meses (5 anos)
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Mês Final</label>
              <MonthYearPicker
                value={endMonth}
                onChange={setEndMonth}
                placeholder="Selecione o mês final"
              />
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground">
              Serão criados aproximadamente <strong>{calculatePreview()}</strong> orçamentos
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="overwrite"
              checked={overwrite}
              onCheckedChange={(checked) => setOverwrite(checked === true)}
            />
            <label htmlFor="overwrite" className="text-sm cursor-pointer">
              Sobrescrever orçamentos existentes
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (replicateType === 'date' && !endMonth)}
              className="btn-primary flex-1"
            >
              {loading ? 'Replicando...' : 'Replicar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

