'use client';

import { useState } from 'react';
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

type ValuationFormData = z.infer<typeof assetValuationSchema>;

interface ValuationFormProps {
  assetId: string;
  onSubmit: (data: ValuationFormData) => Promise<void>;
  onCancel?: () => void;
}

export default function ValuationForm({ assetId, onSubmit, onCancel }: ValuationFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ValuationFormData>({
    resolver: zodResolver(assetValuationSchema),
    defaultValues: {
      asset_id: assetId,
      valuation_date: new Date().toISOString().split('T')[0],
      valuation_type: 'manual',
    },
  });

  const onFormSubmit = async (data: ValuationFormData) => {
    try {
      setLoading(true);
      await onSubmit(data);
      reset();
      toast({
        title: 'Sucesso',
        description: 'Avaliação adicionada com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar avaliação',
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
        <Label htmlFor="value_cents">Valor *</Label>
        <Input
          id="value_cents"
          type="number"
          step="0.01"
          {...register('value_cents', {
            valueAsNumber: true,
            setValueAs: (v) => Math.round((typeof v === 'string' ? parseFloat(v) : v) * 100),
          })}
          placeholder="0.00"
        />
        {errors.value_cents && (
          <p className="text-sm text-red-500 mt-1">{errors.value_cents.message}</p>
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
          {loading ? 'Salvando...' : 'Adicionar Avaliação'}
        </Button>
      </div>
    </form>
  );
}


