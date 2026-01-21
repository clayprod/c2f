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

type ValuationFormData = z.infer<typeof assetValuationSchema>;

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
  } = useForm<ValuationFormData>({
    resolver: zodResolver(assetValuationSchema),
    defaultValues: {
      asset_id: assetId,
      valuation_date: valuation?.valuation_date || new Date().toISOString().split('T')[0],
      valuation_type: valuation?.valuation_type || 'manual',
      value_cents: valuation?.value_cents,
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
        value_cents: valuation.value_cents,
        notes: valuation.notes || '',
      });
    } else {
      reset({
        asset_id: assetId,
        valuation_date: new Date().toISOString().split('T')[0],
        valuation_type: 'manual',
        value_cents: undefined,
        notes: '',
      });
    }
  }, [valuation, assetId, reset]);

  const onFormSubmit = async (data: ValuationFormData) => {
    try {
      setLoading(true);
      await onSubmit(data);
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
        <Label htmlFor="value_cents">Valor *</Label>
        <Input
          id="value_cents"
          type="number"
          step="0.01"
          defaultValue={valuation ? (valuation.value_cents / 100).toFixed(2) : undefined}
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
          {loading ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Adicionar Avaliação')}
        </Button>
      </div>
    </form>
  );
}



