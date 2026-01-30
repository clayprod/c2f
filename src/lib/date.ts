import { format } from 'date-fns';

export const DATE_ONLY_FORMAT = 'yyyy-MM-dd';

export function formatDateOnly(date: Date): string {
  return format(date, DATE_ONLY_FORMAT);
}

export function parseDateOnly(dateString?: string | null): Date | undefined {
  if (!dateString) return undefined;

  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}
