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
    // Usar timezone do Brasil (UTC-3) para determinar o mês atual
    const now = new Date();
    const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const isCurrentMonth = 
      dateObj.getFullYear() === brazilDate.getFullYear() &&
      dateObj.getMonth() === brazilDate.getMonth();
    
    return { formatted, isCurrentMonth };
  }
  
  return formatted;
}

/**
 * Formata um valor em centavos para exibição em reais brasileiros
 * @param cents - Valor em centavos
 * @returns String formatada no formato "R$ 1.234,56"
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return 'R$ 0,00';
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata um valor em reais para exibição em reais brasileiros
 * @param value - Valor em reais
 * @returns String formatada no formato "R$ 1.234,56"
 */
export function formatCurrencyValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Converte uma string formatada em reais para centavos
 * @param formattedValue - String formatada (ex: "R$ 1.234,56" ou "1234,56")
 * @returns Valor em centavos
 */
export function parseCurrencyToCents(formattedValue: string): number {
  if (!formattedValue) return 0;
  // Remove tudo exceto números e vírgula/ponto
  const cleaned = formattedValue.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = parseFloat(cleaned) || 0;
  return Math.round(value * 100);
}

/**
 * Formata um valor numérico para input de moeda brasileira
 * @param value - Valor numérico ou string
 * @returns String formatada para input (ex: "1234,56")
 */
export function formatCurrencyInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  
  let numValue: number;
  if (typeof value === 'string') {
    // Remove formatação existente
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    numValue = parseFloat(cleaned) || 0;
  } else {
    numValue = value;
  }
  
  // Formata com separador de milhares e decimais
  return numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Processa o valor digitado em um input de moeda
 * @param inputValue - Valor digitado pelo usuário
 * @returns String formatada para exibição no input
 */
export function processCurrencyInput(inputValue: string): string {
  if (!inputValue) return '';
  
  // Remove tudo exceto números, vírgula e ponto
  let cleaned = inputValue.replace(/[^\d,.-]/g, '');
  
  if (!cleaned) return '';
  
  // Remove pontos (separadores de milhares) e mantém apenas vírgula como decimal
  // Se tiver vírgula, assume que é decimal
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  
  if (hasComma && hasDot) {
    // Se tem ambos, assume que vírgula é decimal e ponto é milhar
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Apenas vírgula, assume decimal
    cleaned = cleaned.replace(',', '.');
  } else if (hasDot) {
    // Apenas ponto, pode ser decimal ou milhar
    // Se tem mais de 2 dígitos após o ponto, assume que é milhar
    const parts = cleaned.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length <= 2) {
      // Última parte tem 2 ou menos dígitos, assume decimal
      cleaned = parts.join('');
    } else {
      // Assume que pontos são separadores de milhares
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  
  const numValue = parseFloat(cleaned) || 0;
  
  // Formata com separador de milhares e decimais
  return numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}