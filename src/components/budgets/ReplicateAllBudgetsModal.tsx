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

interface ReplicateAllBudgetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  budgetCount: number;
  onSuccess: () => void;
}

export function ReplicateAllBudgetsModal({
  open,
  onOpenChange,
  currentMonth,
  budgetCount,
  onSuccess,
}: ReplicateAllBudgetsModalProps) {
  const [replicateType, setReplicateType] = useState<'months' | 'date'>('months');
  const [months, setMonths] = useState<number>(12);
  const [endMonth, setEndMonth] = useState<string>('');
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate max date (5 years from current month)
  const getMaxDate = () => {
    const [yearStr, monthStr] = currentMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const maxDate = new Date(year, month - 1, 1);
    maxDate.setFullYear(maxDate.getFullYear() + 5);
    return `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const body: any = {
        month: currentMonth,
        overwrite,
      };

      if (replicateType === 'months') {
        if (!months || months < 1) {
          toast({
            title: 'Erro',
            description: 'Número de meses deve ser maior que zero',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        if (months > 60) {
          toast({
            title: 'Erro',
            description: 'Número de meses não pode ultrapassar 60 (5 anos)',
            variant: 'destructive',
          });
          setLoading(false);
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
          setLoading(false);
          return;
        }
        
        // Validate end month is after current month
        const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
        const [endYear, endMonthNum] = endMonth.split('-').map(Number);
        
        if (endYear < currentYear || (endYear === currentYear && endMonthNum <= currentMonthNum)) {
          toast({
            title: 'Erro',
            description: 'Data final deve ser posterior ao mês atual',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        // Validate it's within 5 years
        const maxDate = getMaxDate();
        const [maxYear, maxMonth] = maxDate.split('-').map(Number);
        
        if (endYear > maxYear || (endYear === maxYear && endMonthNum > maxMonth)) {
          toast({
            title: 'Erro',
            description: `Data final não pode ultrapassar ${maxDate} (5 anos)`,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        body.end_month = endMonth;
      }

      const res = await fetch('/api/budgets/replicate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao replicar orçamentos');
      }

      const result = await res.json();
      const { created, overwritten, skipped, budgets_replicated, months_replicated } = result.data;

      toast({
        title: 'Sucesso',
        description: `${created} orçamentos criados, ${overwritten} sobrescritos, ${skipped} pulados. ${budgets_replicated} orçamentos replicados para ${months_replicated} meses.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível replicar os orçamentos',
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
      const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
      const [endYear, endMonthNum] = endMonth.split('-').map(Number);
      // Calculate months from next month after currentMonth to endMonth (inclusive)
      const monthsDiff = (endYear - currentYear) * 12 + (endMonthNum - currentMonthNum);
      return Math.max(0, monthsDiff);
    }
    return 0;
  };

  const previewMonths = calculatePreview();
  const totalBudgets = budgetCount * previewMonths;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replicar Todos os Orçamentos</DialogTitle>
          <DialogDescription>
            Replicar todos os {budgetCount} orçamentos do mês {currentMonth} para os próximos meses
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
                onChange={(value) => {
                  // Validate the selected month
                  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
                  const [selectedYear, selectedMonthNum] = value.split('-').map(Number);
                  
                  // Check if it's after current month
                  if (selectedYear < currentYear || (selectedYear === currentYear && selectedMonthNum <= currentMonthNum)) {
                    toast({
                      title: 'Data inválida',
                      description: 'A data final deve ser posterior ao mês atual',
                      variant: 'destructive',
                    });
                    return;
                  }
                  
                  // Check if it's within 5 years
                  const maxDate = getMaxDate();
                  const [maxYear, maxMonth] = maxDate.split('-').map(Number);
                  
                  if (selectedYear > maxYear || (selectedYear === maxYear && selectedMonthNum > maxMonth)) {
                    toast({
                      title: 'Data inválida',
                      description: `A data final não pode ultrapassar ${maxDate} (5 anos)`,
                      variant: 'destructive',
                    });
                    return;
                  }
                  
                  setEndMonth(value);
                }}
                placeholder="Selecione o mês final"
                minYear={parseInt(currentMonth.split('-')[0])}
                maxYear={parseInt(getMaxDate().split('-')[0])}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo: {getMaxDate()} (5 anos a partir de {currentMonth})
              </p>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-xl space-y-1">
            <p className="text-sm text-muted-foreground">
              Serão criados aproximadamente <strong>{previewMonths}</strong> meses de orçamentos
            </p>
            <p className="text-sm text-muted-foreground">
              Total estimado: <strong>{totalBudgets}</strong> orçamentos ({budgetCount} categorias × {previewMonths} meses)
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
              disabled={loading || (replicateType === 'date' && !endMonth) || previewMonths === 0}
              className="btn-primary flex-1"
            >
              {loading ? 'Replicando...' : 'Replicar Todos'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

