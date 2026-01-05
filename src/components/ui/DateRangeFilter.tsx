'use client';

import { Button } from '@/components/ui/button';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfDay, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  className?: string;
}

type PresetType = 1 | 3 | 6 | 12 | 'custom';

export default function DateRangeFilter({
  startDate,
  endDate,
  onDateChange,
  className = ''
}: DateRangeFilterProps) {
  const [activePreset, setActivePreset] = useState<PresetType>(1);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState<Date | undefined>(undefined);
  const [localTo, setLocalTo] = useState<Date | undefined>(undefined);

  // Calculate date range for a given number of months
  const getDateRangeForMonths = useCallback((months: number) => {
    const today = new Date();
    const end = endOfDay(today);
    const start = startOfMonth(subMonths(today, months - 1));
    return { start, end };
  }, []);

  // Check if the current dates match a preset
  const detectPreset = useCallback((start: string, end: string): PresetType => {
    if (!start || !end) return 1;

    try {
      const startDay = new Date(start);
      const endDay = new Date(end);
      const today = new Date();

      for (const months of [1, 3, 6, 12] as const) {
        const { start: expectedStart, end: expectedEnd } = getDateRangeForMonths(months);

        const startMatch =
          startDay.getFullYear() === expectedStart.getFullYear() &&
          startDay.getMonth() === expectedStart.getMonth() &&
          startDay.getDate() === expectedStart.getDate();

        const endMatch =
          endDay.getFullYear() === expectedEnd.getFullYear() &&
          endDay.getMonth() === expectedEnd.getMonth() &&
          endDay.getDate() === expectedEnd.getDate();

        if (startMatch && endMatch) {
          return months;
        }
      }

      return 'custom';
    } catch {
      return 1;
    }
  }, [getDateRangeForMonths]);

  // Initialize on mount and when external dates change
  useEffect(() => {
    if (startDate && endDate) {
      setLocalFrom(new Date(startDate));
      setLocalTo(new Date(endDate));
      const detected = detectPreset(startDate, endDate);
      setActivePreset(detected);
    } else {
      // Default to 1 month if no dates provided
      const { start, end } = getDateRangeForMonths(1);
      setLocalFrom(start);
      setLocalTo(end);
      setActivePreset(1);
      onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    }
  }, [startDate, endDate, detectPreset, getDateRangeForMonths]);

  // Handle preset button click
  const handlePresetClick = (months: 1 | 3 | 6 | 12) => {
    const { start, end } = getDateRangeForMonths(months);
    setLocalFrom(start);
    setLocalTo(end);
    setActivePreset(months);
    onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  };

  // Handle custom mode
  const handleCustomClick = () => {
    setActivePreset('custom');
  };

  // Handle from date change
  const handleFromChange = (date: Date | undefined) => {
    setLocalFrom(date);
    setFromOpen(false);
    if (date && localTo) {
      const formattedStart = format(date, 'yyyy-MM-dd');
      const formattedEnd = format(localTo, 'yyyy-MM-dd');
      const detected = detectPreset(formattedStart, formattedEnd);
      setActivePreset(detected);
      onDateChange(formattedStart, formattedEnd);
    }
  };

  // Handle to date change
  const handleToChange = (date: Date | undefined) => {
    setLocalTo(date);
    setToOpen(false);
    if (localFrom && date) {
      const formattedStart = format(localFrom, 'yyyy-MM-dd');
      const formattedEnd = format(date, 'yyyy-MM-dd');
      const detected = detectPreset(formattedStart, formattedEnd);
      setActivePreset(detected);
      onDateChange(formattedStart, formattedEnd);
    }
  };

  const presets = [
    { months: 1, label: '1 mês' },
    { months: 3, label: '3 meses' },
    { months: 6, label: '6 meses' },
    { months: 12, label: '12 meses' },
  ] as const;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Preset buttons */}
      {presets.map(({ months, label }) => (
        <Button
          key={months}
          variant={activePreset === months ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetClick(months)}
          className={cn(
            'text-xs h-8 px-3',
            activePreset === months && 'shadow-sm'
          )}
        >
          {label}
        </Button>
      ))}

      {/* Custom button */}
      <Button
        variant={activePreset === 'custom' ? 'default' : 'outline'}
        size="sm"
        onClick={handleCustomClick}
        className={cn(
          'text-xs h-8 px-3',
          activePreset === 'custom' && 'shadow-sm'
        )}
      >
        Personalizado
      </Button>

      {/* Custom date pickers - inline when custom is selected */}
      {activePreset === 'custom' && (
        <>
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 px-3 text-xs font-normal',
                  'bg-muted/40 border-border/50',
                  'hover:bg-muted/60 hover:border-primary/30'
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {localFrom ? format(localFrom, 'dd/MM/yy', { locale: pt }) : 'Início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={localFrom}
                onSelect={handleFromChange}
                initialFocus
                locale={pt}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-xs">até</span>

          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 px-3 text-xs font-normal',
                  'bg-muted/40 border-border/50',
                  'hover:bg-muted/60 hover:border-primary/30'
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {localTo ? format(localTo, 'dd/MM/yy', { locale: pt }) : 'Fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={localTo}
                onSelect={handleToChange}
                initialFocus
                locale={pt}
              />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
