'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePicker({
  date,
  setDate,
  className,
  placeholder = 'Selecione uma data',
  disabled = false
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

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
            !date && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {date ? (
            <span className="text-foreground">{format(date, "dd 'de' MMMM 'de' yyyy", { locale: pt })}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-1">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              setDate(selectedDate);
              if (selectedDate) {
                setOpen(false);
              }
            }}
            disabled={disabled}
            initialFocus
            locale={pt}
            fromDate={new Date(1900, 0, 1)}
            toDate={new Date(2100, 11, 31)}
          />
          {/* Footer actions */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => {
                setDate(undefined);
                setOpen(false);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                setDate(new Date());
                setOpen(false);
              }}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerProps {
  from: Date | undefined;
  to: Date | undefined;
  setFrom: (date: Date | undefined) => void;
  setTo: (date: Date | undefined) => void;
  className?: string;
}

export function DateRangePicker({
  from,
  to,
  setFrom,
  setTo,
  className
}: DateRangePickerProps) {
  const [fromOpen, setFromOpen] = React.useState(false);
  const [toOpen, setToOpen] = React.useState(false);

  const buttonBaseClass = cn(
    'w-full justify-start text-left font-normal',
    'bg-muted/40 border-border/50 text-foreground',
    'hover:bg-muted/60 hover:border-primary/30 hover:text-foreground',
    'focus:ring-2 focus:ring-primary/50 focus:ring-offset-0',
    'transition-all duration-200'
  );

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">De</p>
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button variant={'outline'} className={buttonBaseClass}>
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {from ? (
                <span className="text-foreground">{format(from, 'dd/MM/yyyy', { locale: pt })}</span>
              ) : (
                <span className="text-muted-foreground">Data inicial</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-1">
              <Calendar
                mode="single"
                selected={from}
                onSelect={(selectedDate) => {
                  setFrom(selectedDate);
                  if (selectedDate) {
                    setFromOpen(false);
                  }
                }}
                initialFocus
                locale={pt}
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setFrom(undefined);
                    setFromOpen(false);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrom(new Date());
                    setFromOpen(false);
                  }}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Hoje
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">Até</p>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button variant={'outline'} className={buttonBaseClass}>
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {to ? (
                <span className="text-foreground">{format(to, 'dd/MM/yyyy', { locale: pt })}</span>
              ) : (
                <span className="text-muted-foreground">Data final</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-1">
              <Calendar
                mode="single"
                selected={to}
                onSelect={(selectedDate) => {
                  setTo(selectedDate);
                  if (selectedDate) {
                    setToOpen(false);
                  }
                }}
                initialFocus
                locale={pt}
              />
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setTo(undefined);
                    setToOpen(false);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTo(new Date());
                    setToOpen(false);
                  }}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Hoje
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
