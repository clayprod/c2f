'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { processCurrencyInput, formatCurrencyInput } from '@/lib/utils';

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> {
  value?: number | string | null;
  onValueChange?: (value: number | null) => void;
  onValueBlur?: (value: number | null) => void;
  convertToCents?: boolean; // Se true, retorna valor em centavos; se false, retorna em reais
  allowEmpty?: boolean; // Se true, permite valor vazio (retorna null)
}

/**
 * Componente de input para valores monetários em reais brasileiros
 * Formata automaticamente o valor digitado e converte para centavos se necessário
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      value,
      onValueChange,
      onValueBlur,
      onBlur: onBlurEvent,
      onFocus: onFocusEvent,
      convertToCents = true,
      allowEmpty = false,
      placeholder = '0,00',
      ...props
    },
    ref
  ) => {
    // Converte valor inicial para formato de exibição (reais)
    const getDisplayValue = (val: number | string | null | undefined): string => {
      if (val === null || val === undefined || val === '') return '';
      
      let numValue: number;
      if (typeof val === 'string') {
        // Se é string, pode estar formatada ou não
        const cleaned = val.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
        numValue = parseFloat(cleaned) || 0;
        if (isNaN(numValue)) return '';
      } else {
        // Se é número e convertToCents é true, assume que está em centavos
        if (isNaN(val) || !isFinite(val)) return '';
        numValue = convertToCents ? val / 100 : val;
      }
      
      return formatCurrencyInput(numValue);
    };

    const [displayValue, setDisplayValue] = React.useState<string>(() => getDisplayValue(value));
    const [isFocused, setIsFocused] = React.useState(false);

    // Sincroniza com value externo apenas quando NÃO está editando
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(getDisplayValue(value));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, convertToCents, isFocused]);

    // Converte valor formatado para número (em reais ou centavos)
    const parseValue = (formattedValue: string, isBlur: boolean = false): number | null => {
      if (!formattedValue || formattedValue.trim() === '') {
        return allowEmpty ? null : 0;
      }

      // Remove formatação e converte para número
      const cleaned = formattedValue.replace(/[^\d,.-]/g, '');
      if (!cleaned) return allowEmpty ? null : 0;

      // Processa vírgula e ponto
      const hasComma = cleaned.includes(',');
      const hasDot = cleaned.includes('.');

      let numValue: number;
      if (hasComma && hasDot) {
        // Ambos presentes: vírgula é decimal, ponto é milhar
        numValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
      } else if (hasComma) {
        // Apenas vírgula: decimal
        numValue = parseFloat(cleaned.replace(',', '.')) || 0;
      } else if (hasDot) {
        // Apenas ponto: verifica se é decimal ou milhar
        const parts = cleaned.split('.');
        if (parts.length > 1 && parts[parts.length - 1].length <= 2) {
          // Última parte tem 2 ou menos dígitos: assume decimal
          numValue = parseFloat(cleaned) || 0;
        } else {
          // Assume milhar
          numValue = parseFloat(cleaned.replace(/\./g, '')) || 0;
        }
      } else {
        // Apenas números - interpreta como reais (não centavos)
        numValue = parseFloat(cleaned) || 0;
      }

      if (isNaN(numValue) || !isFinite(numValue)) {
        return allowEmpty ? null : 0;
      }

      // Converte para centavos se necessário
      return convertToCents ? Math.round(numValue * 100) : numValue;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Permite digitação livre - apenas atualiza o displayValue
      // NÃO chama onChange durante digitação para evitar conflitos
      // O valor será processado apenas no blur
      setDisplayValue(inputValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocusEvent?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Formata o valor ao perder o foco
      const formatted = processCurrencyInput(inputValue);
      
      // Chama callbacks com valor parseado ANTES de atualizar o estado
      const parsed = parseValue(formatted, true);
      
      // Atualiza o estado e marca como não focado
      setIsFocused(false);
      setDisplayValue(formatted);
      
      // Chama callbacks
      onValueChange?.(parsed);
      onValueBlur?.(parsed);
      onBlurEvent?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
