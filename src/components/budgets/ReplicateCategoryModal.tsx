'use client';

import { useState, useEffect } from 'react';
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

interface Category {
  id: string;
  name: string;
  type: string;
  source_type?: 'general' | 'credit_card' | 'investment' | 'goal' | 'debt' | 'asset' | null;
}

interface ReplicateCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  categories: Category[];
  onSuccess: () => void;
}

export function ReplicateCategoryModal({
  open,
  onOpenChange,
  currentMonth,
  categories,
  onSuccess,
}: ReplicateCategoryModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  const [initialAmount, setInitialAmount] = useState<string>('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentBudgetAmount, setCurrentBudgetAmount] = useState<number | null>(null);
  const { toast } = useToast();

  // Filter categories: only general or null source_type
  const availableCategories = categories.filter(
    cat => !cat.source_type || cat.source_type === 'general'
  );

  // Calculate max date (5 years from start month or current month)
  const getMaxDate = (fromMonth?: string) => {
    const baseMonth = fromMonth || currentMonth;
    const [yearStr, monthStr] = baseMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const maxDate = new Date(year, month - 1, 1);
    maxDate.setFullYear(maxDate.getFullYear() + 5);
    return `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`;
  };

  // Fetch current budget amount when category is selected
  useEffect(() => {
    if (selectedCategoryId && currentMonth) {
      fetchCurrentBudget();
    } else {
      setCurrentBudgetAmount(null);
    }
  }, [selectedCategoryId, currentMonth]);

  const fetchCurrentBudget = async () => {
    try {
      const res = await fetch(`/api/budgets?month=${currentMonth}`);
      const data = await res.json();
      
      if (data.data) {
        const budget = Array.isArray(data.data) 
          ? data.data.find((b: any) => b.category_id === selectedCategoryId)
          : data.data.budgets?.find((b: any) => b.category_id === selectedCategoryId);
        
        if (budget) {
          const plannedCents = budget.limit_cents || budget.amount_planned_cents || 0;
          setCurrentBudgetAmount(Math.abs(plannedCents) / 100);
        } else {
          setCurrentBudgetAmount(null);
        }
      }
    } catch (error) {
      console.error('Error fetching current budget:', error);
      setCurrentBudgetAmount(null);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validations
      if (!selectedCategoryId) {
        toast({
          title: 'Erro',
          description: 'Selecione uma categoria',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!startMonth) {
        toast({
          title: 'Erro',
          description: 'Selecione uma data inicial',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!endMonth) {
        toast({
          title: 'Erro',
          description: 'Selecione uma data final',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate start month is after current month
      const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
      const [startYear, startMonthNum] = startMonth.split('-').map(Number);
      
      if (startYear < currentYear || (startYear === currentYear && startMonthNum <= currentMonthNum)) {
        toast({
          title: 'Erro',
          description: 'Data inicial deve ser posterior ao mês atual',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate end month is after start month
      const [endYear, endMonthNum] = endMonth.split('-').map(Number);
      
      if (endYear < startYear || (endYear === startYear && endMonthNum <= startMonthNum)) {
        toast({
          title: 'Erro',
          description: 'Data final deve ser posterior à data inicial',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate it's within 5 years from start
      const maxDate = getMaxDate(startMonth);
      const [maxYear, maxMonth] = maxDate.split('-').map(Number);
      
      if (endYear > maxYear || (endYear === maxYear && endMonthNum > maxMonth)) {
        toast({
          title: 'Erro',
          description: `Data final não pode ultrapassar ${maxDate} (5 anos a partir da data inicial)`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate amount if custom amount is enabled
      let amountToUse: number | null = null;
      if (useCustomAmount) {
        if (!initialAmount || parseFloat(initialAmount) <= 0) {
          toast({
            title: 'Erro',
            description: 'Valor inicial deve ser maior que zero',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        amountToUse = parseFloat(initialAmount);
      } else {
        if (!currentBudgetAmount) {
          toast({
            title: 'Erro',
            description: 'Não há orçamento atual para esta categoria. Defina um valor inicial.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        amountToUse = currentBudgetAmount;
      }

      const body: any = {
        category_id: selectedCategoryId,
        start_month: startMonth,
        end_month: endMonth,
        overwrite,
      };

      if (useCustomAmount && amountToUse) {
        body.initial_amount_cents = Math.round(amountToUse * 100);
      }

      const res = await fetch('/api/budgets/replicate-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao replicar orçamento');
      }

      const result = await res.json();
      const { created, overwritten, skipped, months_replicated } = result.data;

      toast({
        title: 'Sucesso',
        description: `${created} orçamentos criados, ${overwritten} sobrescritos, ${skipped} pulados. ${months_replicated} meses replicados.`,
      });

      onOpenChange(false);
      // Reset form
      setSelectedCategoryId('');
      setStartMonth('');
      setEndMonth('');
      setInitialAmount('');
      setUseCustomAmount(false);
      setCurrentBudgetAmount(null);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível replicar o orçamento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePreview = () => {
    if (!startMonth || !endMonth) return 0;
    const [startYear, startMonthNum] = startMonth.split('-').map(Number);
    const [endYear, endMonthNum] = endMonth.split('-').map(Number);
    const monthsDiff = (endYear - startYear) * 12 + (endMonthNum - startMonthNum) + 1; // +1 to include both start and end
    return Math.max(0, monthsDiff);
  };

  const previewMonths = calculatePreview();
  const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);
  const amountToUse = useCustomAmount 
    ? (initialAmount ? parseFloat(initialAmount) : 0)
    : (currentBudgetAmount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replicar Categoria Específica</DialogTitle>
          <DialogDescription>
            Replicar orçamento de uma categoria específica para um período definido
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Categoria</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
            >
              <option value="">Selecione uma categoria</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type === 'income' ? 'Receita' : 'Despesa'})
                </option>
              ))}
            </select>
            {availableCategories.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma categoria disponível. Apenas categorias gerais podem ser replicadas.
              </p>
            )}
          </div>

          {/* Current Budget Info */}
          {selectedCategoryId && currentBudgetAmount !== null && (
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground">
                Orçamento atual ({currentMonth}): <strong>R$ {currentBudgetAmount.toFixed(2)}</strong>
              </p>
            </div>
          )}

          {selectedCategoryId && currentBudgetAmount === null && !useCustomAmount && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-sm text-yellow-600">
                Não há orçamento atual para esta categoria. Você precisará definir um valor inicial.
              </p>
            </div>
          )}

          {/* Custom Amount Toggle */}
          {selectedCategoryId && (
            <div className="flex items-center gap-3">
              <Checkbox
                id="useCustomAmount"
                checked={useCustomAmount}
                onCheckedChange={(checked) => setUseCustomAmount(checked === true)}
              />
              <label htmlFor="useCustomAmount" className="text-sm cursor-pointer">
                Usar valor personalizado
              </label>
            </div>
          )}

          {/* Custom Amount Input */}
          {useCustomAmount && (
            <div>
              <label className="block text-sm font-medium mb-2">Valor Inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none"
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este valor será usado para todos os meses no período selecionado
              </p>
            </div>
          )}

          {/* Start Month */}
          <div>
            <label className="block text-sm font-medium mb-2">Data Inicial</label>
            <MonthYearPicker
              value={startMonth}
              onChange={(value) => {
                // Validate start month is after current month
                const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
                const [selectedYear, selectedMonthNum] = value.split('-').map(Number);
                
                if (selectedYear < currentYear || (selectedYear === currentYear && selectedMonthNum <= currentMonthNum)) {
                  toast({
                    title: 'Data inválida',
                    description: 'A data inicial deve ser posterior ao mês atual',
                    variant: 'destructive',
                  });
                  return;
                }
                
                setStartMonth(value);
                
                // Reset end month if it's before new start month
                if (endMonth) {
                  const [endYear, endMonthNum] = endMonth.split('-').map(Number);
                  if (endYear < selectedYear || (endYear === selectedYear && endMonthNum < selectedMonthNum)) {
                    setEndMonth('');
                  }
                }
              }}
              placeholder="Selecione o mês inicial"
              minYear={parseInt(currentMonth.split('-')[0])}
              maxYear={parseInt(getMaxDate().split('-')[0])}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Deve ser posterior ao mês atual ({currentMonth})
            </p>
          </div>

          {/* End Month */}
          <div>
            <label className="block text-sm font-medium mb-2">Data Final</label>
            <MonthYearPicker
              value={endMonth}
              onChange={(value) => {
                if (!startMonth) {
                  toast({
                    title: 'Data inválida',
                    description: 'Selecione primeiro a data inicial',
                    variant: 'destructive',
                  });
                  return;
                }

                // Validate end month is after start month
                const [startYear, startMonthNum] = startMonth.split('-').map(Number);
                const [selectedYear, selectedMonthNum] = value.split('-').map(Number);
                
                if (selectedYear < startYear || (selectedYear === startYear && selectedMonthNum <= startMonthNum)) {
                  toast({
                    title: 'Data inválida',
                    description: 'A data final deve ser posterior à data inicial',
                    variant: 'destructive',
                  });
                  return;
                }
                
                // Check if it's within 5 years from start
                const maxDate = getMaxDate(startMonth);
                const [maxYear, maxMonth] = maxDate.split('-').map(Number);
                
                if (selectedYear > maxYear || (selectedYear === maxYear && selectedMonthNum > maxMonth)) {
                  toast({
                    title: 'Data inválida',
                    description: `A data final não pode ultrapassar ${maxDate} (5 anos a partir da data inicial)`,
                    variant: 'destructive',
                  });
                  return;
                }
                
                setEndMonth(value);
              }}
              placeholder="Selecione o mês final"
              minYear={startMonth ? parseInt(startMonth.split('-')[0]) : parseInt(currentMonth.split('-')[0])}
              maxYear={startMonth ? parseInt(getMaxDate(startMonth).split('-')[0]) : parseInt(getMaxDate().split('-')[0])}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Máximo: {startMonth ? getMaxDate(startMonth) : getMaxDate()} (5 anos a partir da data inicial)
            </p>
          </div>

          {/* Preview */}
          {previewMonths > 0 && selectedCategory && (
            <div className="p-3 bg-muted/50 rounded-xl space-y-1">
              <p className="text-sm text-muted-foreground">
                Serão criados <strong>{previewMonths}</strong> meses de orçamentos
              </p>
              <p className="text-sm text-muted-foreground">
                Categoria: <strong>{selectedCategory.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Valor: <strong>R$ {amountToUse.toFixed(2)}</strong> por mês
              </p>
            </div>
          )}

          {/* Overwrite Option */}
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

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                // Reset form
                setSelectedCategoryId('');
                setStartMonth('');
                setEndMonth('');
                setInitialAmount('');
                setUseCustomAmount(false);
                setCurrentBudgetAmount(null);
              }}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                !selectedCategoryId ||
                !startMonth ||
                !endMonth ||
                previewMonths === 0 ||
                (!useCustomAmount && !currentBudgetAmount) ||
                (useCustomAmount && (!initialAmount || parseFloat(initialAmount) <= 0))
              }
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


