/**
 * Installment Parser Utility
 * 
 * Detects and parses installment information from transaction descriptions.
 * Common Brazilian patterns: "1/12", "PARCELA 1 DE 12", "PARC 1/12", etc.
 */

export interface InstallmentInfo {
  currentInstallment: number;
  totalInstallments: number;
}

/**
 * Patterns to match installment information in transaction descriptions.
 * Ordered by specificity - more specific patterns first.
 */
const INSTALLMENT_PATTERNS: RegExp[] = [
  // "PARCELA 1 DE 12", "PARCELA 01 DE 12", "PARC 1 DE 12"
  /parcela?\s*(\d{1,2})\s*de\s*(\d{1,2})/i,
  
  // "1ª PARCELA DE 12", "1a PARCELA DE 12", "1 PARCELA DE 12"
  /(\d{1,2})[ªaº]?\s*parcela?\s*de\s*(\d{1,2})/i,
  
  // "PARC 1/12", "PARC. 1/12"
  /parc\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})/i,
  
  // "(1/12)", "[1/12]" - inside parentheses or brackets
  /[(\[]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*[)\]]/,
  
  // "- 1/12", "- 01/12" - with dash prefix (common format)
  /-\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/,
  
  // "1/12", "01/12", "1 / 12" - generic at end or with space after
  /\s(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/,
  
  // "1/12" at the very end of string
  /(\d{1,2})\s*\/\s*(\d{1,2})$/,
];

/**
 * Parse installment information from a transaction description.
 * 
 * @param description - The transaction description to parse
 * @returns InstallmentInfo if installment pattern found, null otherwise
 * 
 * @example
 * parseInstallment("LOJA XYZ 1/12") // { currentInstallment: 1, totalInstallments: 12 }
 * parseInstallment("MERCADO ABC") // null
 * parseInstallment("COMPRA PARCELA 3 DE 6") // { currentInstallment: 3, totalInstallments: 6 }
 */
export function parseInstallment(description: string): InstallmentInfo | null {
  if (!description || typeof description !== 'string') {
    return null;
  }

  for (const pattern of INSTALLMENT_PATTERNS) {
    const match = description.match(pattern);
    
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      
      // Validate the parsed values
      if (isValidInstallment(current, total)) {
        return {
          currentInstallment: current,
          totalInstallments: total,
        };
      }
    }
  }

  return null;
}

/**
 * Validate installment numbers are reasonable.
 * 
 * @param current - Current installment number
 * @param total - Total number of installments
 * @returns true if valid, false otherwise
 */
function isValidInstallment(current: number, total: number): boolean {
  // Must be positive integers
  if (current <= 0 || total <= 0) {
    return false;
  }
  
  // Current cannot exceed total
  if (current > total) {
    return false;
  }
  
  // Reasonable limits (up to 48 installments is common in Brazil)
  if (total > 60) {
    return false;
  }
  
  // Avoid false positives with dates (e.g., "01/12" as month/year)
  // If both numbers are <= 12 and appear to be a date pattern, be cautious
  // We accept them if they're clearly installment context
  // This is handled by the pattern order and specificity
  
  return true;
}

/**
 * Check if a transaction description contains installment information.
 * 
 * @param description - The transaction description to check
 * @returns true if installment pattern found, false otherwise
 */
export function hasInstallment(description: string): boolean {
  return parseInstallment(description) !== null;
}

/**
 * Remove installment pattern from description for cleaner display.
 * 
 * @param description - The transaction description
 * @returns Description with installment pattern removed
 * 
 * @example
 * removeInstallmentPattern("LOJA XYZ 1/12") // "LOJA XYZ"
 * removeInstallmentPattern("COMPRA - 3/6") // "COMPRA"
 */
export function removeInstallmentPattern(description: string): string {
  if (!description || typeof description !== 'string') {
    return description;
  }

  let cleaned = description;
  
  // Remove patterns in reverse order of specificity
  const removalPatterns = [
    /\s*-\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/i,           // "- 1/12" at end
    /\s*[(\[]\s*\d{1,2}\s*\/\s*\d{1,2}\s*[)\]]\s*/g, // "(1/12)" or "[1/12]"
    /\s*parcela?\s*\d{1,2}\s*de\s*\d{1,2}\s*/gi,     // "parcela 1 de 12"
    /\s*\d{1,2}[ªaº]?\s*parcela?\s*de\s*\d{1,2}\s*/gi, // "1ª parcela de 12"
    /\s*parc\.?\s*\d{1,2}\s*\/\s*\d{1,2}\s*/gi,     // "parc 1/12"
    /\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/,                // "1/12" at end
  ];

  for (const pattern of removalPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  return cleaned.trim();
}

/**
 * Generate description for a specific installment.
 * 
 * @param baseDescription - The base description (without installment info)
 * @param installmentNumber - The installment number
 * @param totalInstallments - Total number of installments
 * @returns Formatted description with installment info
 */
export function formatInstallmentDescription(
  baseDescription: string,
  installmentNumber: number,
  totalInstallments: number
): string {
  const cleanDescription = removeInstallmentPattern(baseDescription);
  return `${cleanDescription} (${installmentNumber}/${totalInstallments})`;
}
