'use client';

import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface NumberInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  onIncrement?: () => void;
  onDecrement?: () => void;
  step?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, onIncrement, onDecrement, step = 1, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleIncrement = () => {
      if (inputRef.current) {
        const currentValue = parseFloat(inputRef.current.value) || 0;
        const min = inputRef.current.min ? parseFloat(inputRef.current.min) : undefined;
        const max = inputRef.current.max ? parseFloat(inputRef.current.max) : undefined;
        let newValue = currentValue + step;
        
        if (max !== undefined && newValue > max) {
          newValue = max;
        }
        if (min !== undefined && newValue < min) {
          newValue = min;
        }
        
        inputRef.current.value = newValue.toString();
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
        onIncrement?.();
      }
    };

    const handleDecrement = () => {
      if (inputRef.current) {
        const currentValue = parseFloat(inputRef.current.value) || 0;
        const min = inputRef.current.min ? parseFloat(inputRef.current.min) : undefined;
        let newValue = currentValue - step;
        
        if (min !== undefined && newValue < min) {
          newValue = min;
        } else if (newValue < 0 && min === undefined) {
          newValue = 0;
        }
        
        inputRef.current.value = newValue.toString();
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
        onDecrement?.();
      }
    };

    return (
      <div className="relative w-full">
        <Input
          {...props}
          type="number"
          ref={inputRef}
          className={cn('pr-8', className)}
        />
        <div className="absolute right-1 top-1 bottom-1 w-6 flex flex-col border-l border-border rounded-r-md bg-muted/30 pointer-events-none">
          <button
            type="button"
            onClick={handleIncrement}
            className="flex-1 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors rounded-tr-md pointer-events-auto cursor-pointer"
            aria-label="Incrementar"
            tabIndex={-1}
          >
            <i className="bx bx-chevron-up text-xs"></i>
          </button>
          <div className="h-px bg-border"></div>
          <button
            type="button"
            onClick={handleDecrement}
            className="flex-1 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors rounded-br-md pointer-events-auto cursor-pointer"
            aria-label="Decrementar"
            tabIndex={-1}
          >
            <i className="bx bx-chevron-down text-xs"></i>
          </button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export { NumberInput };

