/**
 * CSV Parser for cashflow.csv format
 * Format: ID;DESCRIÇÃO;DATA;VALOR;CONTA;CATEGORIA;TIPO
 * 
 * Example: 5409;BARBEIRO;45878;50;C.C CLAYTON;BELEZA;D
 * 
 * IMPROVED: Better number parsing with format detection
 */

export interface ParsedCSVTransaction {
  id: string; // Original ID from CSV
  description: string;
  date: string; // ISO date string (YYYY-MM-DD)
  amount: number; // In reais (not cents)
  accountName: string;
  categoryName: string;
  type: 'income' | 'expense'; // E = income, D = expense
}

/**
 * Parse amount string with intelligent format detection
 * Handles Brazilian format (1.234,56), US format (1,234.56), and plain numbers
 */
function parseAmount(amountStr: string): number | null {
  if (!amountStr || amountStr.trim() === '') {
    return null;
  }

  // Remove whitespace and currency symbols
  let cleaned = amountStr.trim().replace(/[^\d.,-]/g, '');
  
  if (cleaned === '' || cleaned === '-') {
    return null;
  }

  // Check for negative sign
  const isNegative = cleaned.startsWith('-');
  cleaned = cleaned.replace(/^-/, '');

  // Count occurrences
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;
  
  let normalized: string;

  if (commaCount === 0 && dotCount === 0) {
    // Plain integer: "288" -> 288
    normalized = cleaned;
  } else if (commaCount === 1 && dotCount === 0) {
    // Only comma: could be "288,00" (Brazilian decimal) or "1,234" (US thousand)
    const parts = cleaned.split(',');
    if (parts[1].length >= 1 && parts[1].length <= 2) {
      // Likely Brazilian decimal: "288,00" or "180,2" -> "288.00" or "180.2"
      normalized = cleaned.replace(',', '.');
    } else {
      // Likely US thousand separator: "1,234" -> "1234"
      normalized = cleaned.replace(',', '');
    }
  } else if (commaCount === 0 && dotCount === 1) {
    // Only dot: could be "288.00" (decimal) or "1.234" (Brazilian thousand)
    const parts = cleaned.split('.');
    if (parts[1].length === 2) {
      // Likely decimal: "288.00" -> "288.00"
      normalized = cleaned;
    } else {
      // Likely Brazilian thousand: "1.234" -> "1234"
      normalized = cleaned.replace('.', '');
    }
  } else if (commaCount >= 1 && dotCount >= 1) {
    // Both separators present
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Brazilian format: "1.234,56" -> "1234.56"
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: "1,234.56" -> "1234.56"
      normalized = cleaned.replace(/,/g, '');
    }
  } else {
    // Multiple of same separator - assume thousand separators
    if (commaCount > 1) {
      // "1,234,567" -> "1234567"
      normalized = cleaned.replace(/,/g, '');
    } else {
      // "1.234.567" -> "1234567"
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const amount = parseFloat(normalized);
  
  if (isNaN(amount) || amount === 0) {
    return null;
  }

  return isNegative ? -amount : amount;
}

/**
 * Convert Excel date number to ISO date string
 * Excel date: number of days since 1900-01-01
 * Note: Excel incorrectly treats 1900 as a leap year, so we adjust
 */
function excelDateToISO(excelDate: number): string | null {
  try {
    // Excel epoch is 1900-01-01
    // Excel date 1 = 1900-01-01, but Excel has a bug treating 1900 as leap year
    // So we subtract 2 days to account for this
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30 (Excel's actual epoch)
    const daysSinceEpoch = excelDate - 1; // Excel date 1 = 1900-01-01
    const date = new Date(excelEpoch);
    date.setUTCDate(date.getUTCDate() + daysSinceEpoch);
    
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
  } catch (error) {
    // Fallback: try to parse as regular date if Excel conversion fails
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  }
}

/**
 * Parse date string with multiple format support
 * Supports: Excel dates (numbers), DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  const trimmed = dateStr.trim();
  
  // Try Excel date number first (e.g., "45878")
  const excelDate = parseFloat(trimmed);
  if (!isNaN(excelDate) && excelDate > 1 && excelDate < 50000 && !trimmed.includes('/')) {
    const result = excelDateToISO(excelDate);
    if (result) return result;
  }
  
  // Try DD/MM/YYYY format (Brazilian) - e.g., "12/01/2026"
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    
    // Validate date components
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month - 1) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Try MM/DD/YYYY format (US) - e.g., "01/12/2026"
  const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    const month = parseInt(mmddyyyyMatch[1], 10);
    const day = parseInt(mmddyyyyMatch[2], 10);
    const year = parseInt(mmddyyyyMatch[3], 10);
    
    // If day > 12, it's definitely DD/MM/YYYY, so skip this interpretation
    if (day <= 12 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Try YYYY-MM-DD format (ISO) - e.g., "2026-01-12"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Try standard Date parsing as last resort
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): ParsedCSVTransaction[] {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedCSVTransaction[] = [];
  const errors: string[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const parts = line.split(';').map(p => p.trim());
    
    if (parts.length < 7) {
      errors.push(`Linha ${lineIndex + 1}: formato inválido (esperado 7 colunas, encontrado ${parts.length})`);
      continue;
    }

    const [id, description, dateStr, amountStr, accountName, categoryName, typeStr] = parts;

    // Parse date with multiple format support
    const date = parseDate(dateStr);
    if (!date) {
      errors.push(`Linha ${lineIndex + 1}: data inválida "${dateStr}"`);
      continue;
    }

    // Parse amount with improved logic
    const amount = parseAmount(amountStr);
    if (amount === null) {
      errors.push(`Linha ${lineIndex + 1}: valor inválido "${amountStr}"`);
      continue;
    }

    // Parse type: E = income, D = expense
    const type = typeStr.toUpperCase() === 'E' ? 'income' : 'expense';

    transactions.push({
      id: id || `csv-${lineIndex}`,
      description: description || 'Sem descrição',
      date,
      amount: Math.abs(amount), // Always positive, type indicates direction
      accountName: accountName || 'Conta não especificada',
      categoryName: categoryName || 'Outros',
      type,
    });
  }

  // Log errors for debugging
  if (errors.length > 0) {
    console.warn('[CSV Parser] Erros encontrados:', errors.slice(0, 10));
  }

  return transactions;
}

/**
 * Generate dedupe hash for transaction
 */
export function generateDedupeHash(tx: ParsedCSVTransaction): string {
  const { createHash } = require('crypto');
  const hashInput = `${tx.date}|${tx.amount}|${tx.description.toLowerCase().trim()}|${tx.accountName.toLowerCase().trim()}`;
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Validate CSV format and return sample
 */
export function validateCSVFormat(content: string): {
  valid: boolean;
  sample?: ParsedCSVTransaction;
  error?: string;
  totalLines: number;
} {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { valid: false, error: 'Arquivo vazio', totalLines: 0 };
  }

  const firstLine = lines[0];
  const parts = firstLine.split(';');
  
  if (parts.length < 7) {
    return { 
      valid: false, 
      error: `Formato inválido. Esperado 7 colunas separadas por ponto-e-vírgula (;), encontrado ${parts.length}.\n\nFormato correto:\nID;DESCRIÇÃO;DATA;VALOR;CONTA;CATEGORIA;TIPO`,
      totalLines: lines.length 
    };
  }

  // Try to parse first transaction
  const transactions = parseCSV(firstLine);
  
  if (transactions.length === 0) {
    return { 
      valid: false, 
      error: 'Não foi possível parsear a primeira linha. Verifique o formato do arquivo.',
      totalLines: lines.length 
    };
  }

  return { 
    valid: true, 
    sample: transactions[0],
    totalLines: lines.length 
  };
}
