/**
 * CSV Parser for cashflow.csv format
 * Format: ID;DESCRIÇÃO;DATA;VALOR;CONTA;CATEGORIA;TIPO
 * 
 * Example: 5409;BARBEIRO;45878;50;C.C CLAYTON;BELEZA;D
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
 * Convert Excel date number to ISO date string
 * Excel date: number of days since 1900-01-01
 * Note: Excel incorrectly treats 1900 as a leap year, so we adjust
 */
function excelDateToISO(excelDate: number): string {
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
    throw new Error(`Invalid date: ${excelDate}`);
  }
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): ParsedCSVTransaction[] {
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedCSVTransaction[] = [];

  for (const line of lines) {
    const parts = line.split(';').map(p => p.trim());
    
    if (parts.length < 7) {
      continue; // Skip invalid lines
    }

    const [id, description, dateStr, amountStr, accountName, categoryName, typeStr] = parts;

    // Parse date (Excel date number)
    const excelDate = parseFloat(dateStr);
    if (isNaN(excelDate)) {
      continue; // Skip invalid dates
    }
    const date = excelDateToISO(excelDate);

    // Parse amount (Brazilian format: comma as decimal separator)
    // Remove any thousand separators (dots) and replace comma with dot
    const normalizedAmount = amountStr.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(normalizedAmount);
    if (isNaN(amount) || amount === 0) {
      continue; // Skip invalid or zero amounts
    }

    // Parse type: E = income, D = expense
    const type = typeStr.toUpperCase() === 'E' ? 'income' : 'expense';

    transactions.push({
      id,
      description: description || 'Sem descrição',
      date,
      amount: Math.abs(amount), // Always positive, type indicates direction
      accountName: accountName || 'Conta não especificada',
      categoryName: categoryName || 'Outros',
      type,
    });
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

