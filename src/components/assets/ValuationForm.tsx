'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetValuationSchema } from '@/lib/validation/schemas';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyInput } from '@/lib/utils';

type ValuationFormData = z.infer<typeof assetValuationSchema>;

// Form data type that accepts value as string (reais) before conversion
type ValuationFormInput = Omit<ValuationFormData, 'value_cents'> & {
  value_reais: string;
};

interface Valuation {
  id: string;
  valuation_date: string;
  value_cents: number;
  valuation_type: 'manual' | 'depreciation' | 'market';
  notes?: string;
}

interface ValuationFormProps {
  assetId: string;
  valuation?: Valuation;
  onSubmit: (data: ValuationFormData) => Promise<void>;
  onCancel?: () => void;
}

// Schema for form input (accepts value as string in reais)
const valuationFormInputSchema = z.object({
  asset_id: z.string().uuid('ID do bem inválido'),
  valuation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  value_reais: z.string().min(1, 'Valor é obrigatório').refine(
    (val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    },
    { message: 'Valor deve ser um número positivo' }
  ),
  valuation_type: z.enum(['manual', 'depreciation', 'market']).default('manual'),
  notes: z.string().optional(),
});

export default function ValuationForm({ assetId, valuation, onSubmit, onCancel }: ValuationFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEditing = !!valuation;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ValuationFormInput>({
    resolver: zodResolver(valuationFormInputSchema),
    defaultValues: {
      asset_id: assetId,
      valuation_date: valuation?.valuation_date || new Date().toISOString().split('T')[0],
      valuation_type: valuation?.valuation_type || 'manual',
      value_reais: valuation ? formatCurrencyInput(valuation.value_cents / 100) : '',
      notes: valuation?.notes || '',
    },
  });

  // Reset form when valuation changes (switching between edit targets)
  useEffect(() => {
    if (valuation) {
      reset({
        asset_id: assetId,
        valuation_date: valuation.valuation_date,
        valuation_type: valuation.valuation_type,
        value_reais: formatCurrencyInput(valuation.value_cents / 100),
        notes: valuation.notes || '',
      });
    } else {
      reset({
        asset_id: assetId,
        valuation_date: new Date().toISOString().split('T')[0],
        valuation_type: 'manual',
        value_reais: '',
        notes: '',
      });
    }
  }, [valuation, assetId, reset]);

  const onFormSubmit = async (data: ValuationFormInput) => {
    try {
      setLoading(true);
      // Convert value_reais (string) to value_cents (number)
      const valueInReais = parseFloat(data.value_reais.replace(',', '.'));
      const valueCents = Math.round(valueInReais * 100);

      // Transform to the expected API format
      const apiData: ValuationFormData = {
        asset_id: data.asset_id,
        valuation_date: data.valuation_date,
        value_cents: valueCents,
        valuation_type: data.valuation_type,
        notes: data.notes,
      };

      await onSubmit(apiData);
      if (!isEditing) {
        reset();
      }
      toast({
        title: 'Sucesso',
        description: isEditing ? 'Avaliação atualizada com sucesso!' : 'Avaliação adicionada com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || (isEditing ? 'Erro ao atualizar avaliação' : 'Erro ao adicionar avaliação'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="valuation_date">Data da Avaliação *</Label>
        <Input
          id="valuation_date"
          type="date"
          {...register('valuation_date')}
        />
        {errors.valuation_date && (
          <p className="text-sm text-red-500 mt-1">{errors.valuation_date.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="value_reais">Valor (R$) *</Label>
        <Input
          id="value_reais"
          type="text"
          inputMode="decimal"
          {...register('value_reais')}
          placeholder="0,00"
        />
        {errors.value_reais && (
          <p className="text-sm text-red-500 mt-1">{errors.value_reais.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="valuation_type">Tipo de Avaliação</Label>
        <Select
          value={watch('valuation_type') || 'manual'}
          onValueChange={(value) => setValue('valuation_type', value as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="depreciation">Depreciação</SelectItem>
            <SelectItem value="market">Mercado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Observações sobre a avaliação"
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Adicionar Avaliação')}
        </Button>
      </div>
    </form>
  );
}



