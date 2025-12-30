// Parser para arquivos OFX (Open Financial Exchange)
// Formato padrão usado por bancos brasileiros

export interface OFXTransaction {
  type: 'DEBIT' | 'CREDIT';
  date: string; // ISO format
  amount: number;
  description: string;
  fitId: string; // Financial Institution Transaction ID (usado para deduplicação)
}

export interface OFXAccount {
  bankId: string;
  branchId: string;
  accountId: string;
  accountType: string;
  currency: string;
}

export interface OFXData {
  account: OFXAccount;
  transactions: OFXTransaction[];
  balance: number;
  balanceDate: string;
}

/**
 * Parse OFX file content and extract transactions
 */
export function parseOFX(content: string): OFXData | null {
  try {
    console.log('[OFX-PARSER] Starting OFX parsing...');

    // Extract account information
    const bankIdMatch = content.match(/<BANKID>([^<\n]+)/);
    const branchIdMatch = content.match(/<BRANCHID>([^<\n]+)/);
    const accountIdMatch = content.match(/<ACCTID>([^<\n]+)/);
    const accountTypeMatch = content.match(/<ACCTTYPE>([^<\n]+)/);
    const currencyMatch = content.match(/<CURDEF>([^<\n]+)/);

    const account: OFXAccount = {
      bankId: bankIdMatch?.[1]?.trim() || '',
      branchId: branchIdMatch?.[1]?.trim() || '',
      accountId: accountIdMatch?.[1]?.trim() || '',
      accountType: accountTypeMatch?.[1]?.trim() || '',
      currency: currencyMatch?.[1]?.trim() || 'BRL',
    };

    console.log('[OFX-PARSER] Account extracted:', account);

    // Extract balance
    const balanceMatch = content.match(/<BALAMT>([^<\n]+)/);
    const balanceDateMatch = content.match(/<DTASOF>([^<\n]+)/);

    const balance = balanceMatch ? parseFloat(balanceMatch[1].trim()) : 0;
    const balanceDate = balanceDateMatch
      ? convertOFXDateToISO(balanceDateMatch[1].trim())
      : new Date().toISOString();

    console.log('[OFX-PARSER] Balance:', balance, 'Date:', balanceDate);

    // Extract transactions using regex
    const transactions: OFXTransaction[] = [];

    // Match all STMTTRN blocks
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = transactionRegex.exec(content)) !== null) {
      const transactionContent = match[1];

      const typeMatch = transactionContent.match(/<TRNTYPE>([^<\n]+)/);
      const dateMatch = transactionContent.match(/<DTPOSTED>([^<\n]+)/);
      const amountMatch = transactionContent.match(/<TRNAMT>([^<\n]+)/);
      const fitIdMatch = transactionContent.match(/<FITID>([^<\n]+)/);

      // Try MEMO first, then NAME for description
      let descriptionMatch = transactionContent.match(/<MEMO>([^<\n]+)/);
      if (!descriptionMatch) {
        descriptionMatch = transactionContent.match(/<NAME>([^<\n]+)/);
      }

      if (dateMatch && amountMatch && fitIdMatch) {
        const type = (typeMatch?.[1]?.trim()?.toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT';
        const amount = parseFloat(amountMatch[1].trim());
        const description = descriptionMatch?.[1]?.trim() || 'Sem descrição';
        const fitId = fitIdMatch[1].trim();
        const date = convertOFXDateToISO(dateMatch[1].trim());

        transactions.push({
          type,
          date,
          amount,
          description,
          fitId,
        });
      }
    }

    console.log(`[OFX-PARSER] ${transactions.length} transactions extracted`);

    return {
      account,
      transactions,
      balance,
      balanceDate,
    };
  } catch (error) {
    console.error('[OFX-PARSER] Error parsing OFX file:', error);
    return null;
  }
}

/**
 * Convert OFX date format to ISO string
 * OFX format: YYYYMMDDHHMMSS[timezone]
 * Example: 20250903000000[-3:BRT]
 */
function convertOFXDateToISO(ofxDate: string): string {
  try {
    // Remove timezone if present (e.g., [-3:BRT])
    const cleanDate = ofxDate.replace(/\[.*?\]$/, '').trim();

    if (cleanDate.length < 8) {
      return new Date().toISOString().split('T')[0];
    }

    // Extract components
    const year = cleanDate.substring(0, 4);
    const month = cleanDate.substring(4, 6);
    const day = cleanDate.substring(6, 8);

    // Return just the date part (YYYY-MM-DD)
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('[OFX-PARSER] Error converting OFX date:', error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Map OFX transaction type to c2f type
 */
export function mapOFXTypeToTransactionType(
  ofxType: 'DEBIT' | 'CREDIT',
  amount: number
): 'income' | 'expense' {
  // CREDIT = money coming in (positive)
  // DEBIT = money going out (negative)
  // But we also check the amount sign for safety
  if (ofxType === 'CREDIT' || amount > 0) {
    return 'income';
  }
  return 'expense';
}

/**
 * Convert OFX transactions to import format
 */
export interface ImportTransaction {
  id: string;
  description: string;
  date: string;
  amount: number;
  type: 'E' | 'D';
  source: 'OFX';
}

export function convertOFXToImportFormat(ofxData: OFXData): ImportTransaction[] {
  return ofxData.transactions.map((tx) => ({
    id: tx.fitId,
    description: tx.description,
    date: tx.date,
    amount: Math.abs(tx.amount),
    type: tx.type === 'CREDIT' || tx.amount > 0 ? 'E' : 'D',
    source: 'OFX' as const,
  }));
}
