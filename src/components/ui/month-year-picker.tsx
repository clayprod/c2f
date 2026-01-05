'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MonthYearPickerProps {
  value: string; // Format: YYYY-MM
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const monthAbbreviations = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'
];

export function MonthYearPicker({
  value,
  onChange,
  className,
  placeholder = 'Selecione o mês',
  disabled = false,
  minYear,
  maxYear
}: MonthYearPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse value (YYYY-MM format)
  const currentYear = value ? parseInt(value.split('-')[0]) : new Date().getFullYear();
  const currentMonth = value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth();

  // Generate years range
  const currentYearValue = new Date().getFullYear();
  const startYear = minYear ?? (currentYearValue - 50);
  const endYear = maxYear ?? (currentYearValue + 50);

  const handleMonthChange = (monthIndex: number) => {
    const month = monthIndex + 1;
    const formattedMonth = String(month).padStart(2, '0');
    onChange(`${currentYear}-${formattedMonth}`);
    setOpen(false);
  };

  const handleYearChange = (delta: number) => {
    const newYear = currentYear + delta;
    if (newYear >= startYear && newYear <= endYear) {
      const month = currentMonth + 1;
      const formattedMonth = String(month).padStart(2, '0');
      onChange(`${newYear}-${formattedMonth}`);
    }
  };

  const handleThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    onChange(`${year}-${month}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const displayValue = value
    ? `${months[currentMonth]} de ${currentYear}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            'bg-muted/40 border-border/50 text-foreground',
            'hover:bg-muted/60 hover:border-primary/30 hover:text-foreground',
            'focus:ring-2 focus:ring-primary/50 focus:ring-offset-0',
            'transition-all duration-200',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {value ? (
            <span className="text-foreground">{displayValue}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-4">
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => handleYearChange(-1)}
              disabled={currentYear <= startYear}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                "bg-muted/40 border border-border/50",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/60 hover:border-primary/30",
                "transition-all duration-200",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-muted/40"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-base font-semibold text-foreground">
              {currentYear}
            </span>
            <button
              type="button"
              onClick={() => handleYearChange(1)}
              disabled={currentYear >= endYear}
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                "bg-muted/40 border border-border/50",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/60 hover:border-primary/30",
                "transition-all duration-200",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-muted/40"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {monthAbbreviations.map((monthAbbr, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleMonthChange(index)}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  currentMonth === index
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                    : 'bg-muted/40 text-foreground border border-border/50 hover:bg-muted/60 hover:border-primary/30'
                )}
              >
                {monthAbbr}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleThisMonth}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Este mês
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
