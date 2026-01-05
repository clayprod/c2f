'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface InlineBudgetEditorProps {
  budgetId?: string;
  categoryId: string;
  categoryName: string;
  currentValue?: number; // in reais
  minimumValue?: number; // in reais - minimum allowed based on auto contributions
  month: string; // YYYY-MM format
  onSave: (value: number) => Promise<void>;
  onCancel?: () => void;
  mode: 'create' | 'edit';
}

export function InlineBudgetEditor({
  budgetId,
  categoryId,
  categoryName,
  currentValue = 0,
  minimumValue = 0,
  month,
  onSave,
  onCancel,
  mode,
}: InlineBudgetEditorProps) {
  const [isEditing, setIsEditing] = useState(mode === 'create');
  const [value, setValue] = useState(currentValue.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setValue(currentValue.toString());
  }, [currentValue]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setValue(currentValue.toString());
    setIsEditing(false);
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };

  const handleSave = async () => {
    const numValue = parseFloat(value.replace(',', '.'));
    
    if (isNaN(numValue) || numValue <= 0) {
      setError('Valor deve ser maior que zero');
      return;
    }

    // Validate minimum value
    if (minimumValue > 0 && numValue < minimumValue) {
      setError(`Valor mínimo é ${formatCurrency(minimumValue)} devido a contribuições automáticas`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(numValue);
      setIsEditing(false);
    } catch (err: any) {
      // Check if error contains minimum information
      if (err.minimum_amount) {
        setError(`Valor mínimo é ${formatCurrency(err.minimum_amount)}. ${err.suggestion || ''}`);
      } else {
        setError(err.message || 'Erro ao salvar');
      }
      toast({
        title: 'Erro',
        description: err.error || err.message || 'Erro ao salvar orçamento',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  if (!isEditing && mode === 'edit') {
    return (
      <div className="flex items-center gap-2 group">
        <span 
          className="font-medium cursor-pointer hover:text-primary transition-colors"
          onDoubleClick={handleStartEdit}
          title="Clique duplo para editar"
        >
          {formatCurrency(currentValue)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStartEdit}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Editar valor"
        >
          <i className="bx bx-edit text-xs"></i>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                // Allow only numbers, comma and dot
                const newValue = e.target.value.replace(/[^\d,.-]/g, '');
                setValue(newValue);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className={`w-full pl-8 pr-3 py-2 rounded-lg bg-muted/50 border ${
                error ? 'border-red-500' : 'border-border'
              } focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors`}
              placeholder="0,00"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !value || parseFloat(value.replace(',', '.')) <= 0}
          size="sm"
          className="btn-primary min-w-[40px]"
          title="Salvar (Enter)"
        >
          {saving ? (
            <i className="bx bx-loader-alt bx-spin"></i>
          ) : (
            <i className="bx bx-check"></i>
          )}
        </Button>
        {mode === 'edit' && (
          <Button
            onClick={handleCancel}
            disabled={saving}
            variant="ghost"
            size="sm"
            className="min-w-[40px]"
            title="Cancelar (ESC)"
          >
            <i className="bx bx-x"></i>
          </Button>
        )}
      </div>
      {minimumValue > 0 && (
        <p className="text-xs text-muted-foreground">
          Valor mínimo: {formatCurrency(minimumValue)} (contribuições automáticas)
        </p>
      )}
      {mode === 'create' && minimumValue === 0 && (
        <p className="text-xs text-muted-foreground">
          Pressione Enter para salvar ou ESC para cancelar
        </p>
      )}
    </div>
  );
}

