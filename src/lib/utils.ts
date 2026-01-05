import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Verifica se um cartão de crédito expirou
 * O cartão expira no final do mês do expiration_date
 * @param expirationDate - Data de expiração no formato YYYY-MM-DD ou YYYY-MM
 * @returns true se o cartão expirou, false caso contrário
 */
export function isCreditCardExpired(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;

  try {
    // Parse da data (pode ser YYYY-MM-DD ou YYYY-MM)
    const dateStr = expirationDate.trim();
    const parts = dateStr.split('-');
    
    if (parts.length < 2) return false;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);

    if (isNaN(year) || isNaN(month)) return false;

    // Data atual
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() retorna 0-11

    // O cartão expira no final do mês do expiration_date
    // Se estamos no mesmo mês/ano ou depois, o cartão expirou
    if (currentYear > year) return true;
    if (currentYear === year && currentMonth > month) return true;

    return false;
  } catch (error) {
    console.error('Error checking credit card expiration:', error);
    return false;
  }
}

/**
 * Formata uma data no formato "mmm/aa" (ex: "Jan/24", "Fev/24")
 * @param date - Data como Date, string (YYYY-MM-DD ou YYYY-MM) ou timestamp
 * @param options - Opções adicionais
 * @returns String formatada no formato "mmm/aa" e informações sobre se é o mês corrente
 */
export function formatMonthYear(
  date: Date | string | number,
  options?: { returnCurrentMonthInfo?: boolean }
): string | { formatted: string; isCurrentMonth: boolean } {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Se for string no formato YYYY-MM ou YYYY-MM-DD
    const parts = date.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // getMonth() usa 0-11
      dateObj = new Date(year, month, 1);
    } else {
      dateObj = new Date(date);
    }
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  const formatted = format(dateObj, 'MMM/yy', { locale: pt });
  
  if (options?.returnCurrentMonthInfo) {
    const now = new Date();
    const isCurrentMonth = 
      dateObj.getFullYear() === now.getFullYear() &&
      dateObj.getMonth() === now.getMonth();
    
    return { formatted, isCurrentMonth };
  }
  
  return formatted;
}