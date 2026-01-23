/**
 * Mapping of Brazilian bank codes (COMPE/ISPB) to Pluggy connector IDs
 * This is used when MeuPluggy (Open Finance) is used, as it doesn't return connector info per account
 * 
 * Bank codes can be found in the transferNumber field: "BANK_CODE/AGENCY/ACCOUNT"
 * Example: "260/0001/20495412-0" -> Bank code 260 = Nubank
 * 
 * Logos are stored locally in public/assets/connector-icons/
 */

// Base URL for local connector icons
const CONNECTOR_ICON_BASE_URL = '/assets/connector-icons';

// Fallback connector ID (MeuPluggy)
const FALLBACK_CONNECTOR_ID = 1;

// Map of bank code -> Pluggy connector ID
export const BANK_CODE_TO_CONNECTOR: Record<string, number> = {
  // Major banks - IDs atualizados conforme lista fornecida
  '001': 211,  // Banco do Brasil
  '104': 216,  // Caixa Econômica Federal
  '237': 203,  // Bradesco
  '341': 201,  // Itaú
  '033': 208,  // Santander
  '260': 212,  // Nubank (Nu Pagamentos)
  '077': 215,  // Banco Inter
  '336': 226,  // C6 Bank
  '290': 220,  // Ágora Investimentos (PagSeguro/PagBank)
  '380': 224,  // Ailos (PicPay)
  '323': 206,  // Mercado Pago
  '756': 228,  // Sicoob
  '748': 227,  // Sicredi
  '136': 228,  // Sicoob (Unicred pode usar mesmo logo)
  '212': 236,  // Banco Original
  '655': 229,  // Banco Safra (Votorantim/BV)
  '637': 229,  // Banco Safra
  '422': 229,  // Banco Safra
  '746': 204,  // Modal Mais
  '389': 1,    // Banco Mercantil (fallback)
  '394': 1,    // Banco BMC (fallback)
  '021': 1,    // Banestes (fallback)
  '041': 1,    // Banrisul (fallback)
  '070': 1,    // BRB (fallback)
  '047': 1,    // Banese (fallback)
  '004': 1,    // BNB - Banco do Nordeste (fallback)
  '037': 1,    // Banpará (fallback)
  '084': 1,    // Uniprime (fallback)
  '623': 1,    // Pan (fallback - pode ser 243 Stone)
  '121': 1,    // Agibank (fallback)
  '403': 1,    // Cora (fallback)
  '280': 1,    // Will Bank (Avista) (fallback)
  '332': 1,    // Acesso Soluções (fallback)
  '364': 239,  // EFI (Gerencianet/EfiBank)
  '125': 1,    // Banco Plural (fallback)
  '739': 1,    // Cetelem (fallback)
  '626': 226,  // Banco C6 Consignado
  '329': 238,  // Iti (QI SCD/Next)
  '082': 1,    // Topázio (fallback)
  '174': 1,    // Pefisa (fallback)
  '310': 1,    // Vortx (fallback)
  '413': 1,    // BV Financeira (fallback)
};

/**
 * Map of institution name patterns to connector IDs
 * Uses partial matching (contains) - order matters (more specific first)
 */
const INSTITUTION_NAME_PATTERNS: Array<{ pattern: string; connectorId: number }> = [
  // Most specific patterns first
  { pattern: 'nu pagamentos', connectorId: 212 },
  { pattern: 'nubank', connectorId: 212 },
  { pattern: 'banco do brasil', connectorId: 211 },
  { pattern: 'bradesco', connectorId: 203 },
  { pattern: 'itau', connectorId: 201 },
  { pattern: 'itaú', connectorId: 201 },
  { pattern: 'santander', connectorId: 208 },
  { pattern: 'caixa economica', connectorId: 216 },
  { pattern: 'caixa', connectorId: 216 },
  { pattern: 'banco inter', connectorId: 215 },
  { pattern: 'inter', connectorId: 215 },
  { pattern: 'c6 bank', connectorId: 226 },
  { pattern: 'c6', connectorId: 226 },
  { pattern: 'mercado pago', connectorId: 206 },
  { pattern: 'xp investimentos', connectorId: 202 },
  { pattern: 'xp invest', connectorId: 202 },
  { pattern: 'xp', connectorId: 202 },
  { pattern: 'nuinvest', connectorId: 207 },
  { pattern: 'rico investimentos', connectorId: 205 },
  { pattern: 'rico', connectorId: 205 },
  { pattern: 'modal mais', connectorId: 204 },
  { pattern: 'banco modal', connectorId: 204 },
  { pattern: 'modal', connectorId: 204 },
  { pattern: 'pagseguro', connectorId: 220 },
  { pattern: 'pagbank', connectorId: 220 },
  { pattern: 'agora investimentos', connectorId: 220 },
  { pattern: 'ágora investimentos', connectorId: 220 },
  { pattern: 'picpay', connectorId: 224 },
  { pattern: 'ailos', connectorId: 224 },
  { pattern: 'sicoob', connectorId: 228 },
  { pattern: 'sicredi', connectorId: 227 },
  { pattern: 'unicred', connectorId: 228 },
  { pattern: 'banco original', connectorId: 236 },
  { pattern: 'original', connectorId: 236 },
  { pattern: 'votorantim', connectorId: 229 },
  { pattern: 'bv', connectorId: 229 },
  { pattern: 'banco safra', connectorId: 229 },
  { pattern: 'safra', connectorId: 229 },
  { pattern: 'sofisa', connectorId: 1 },
  { pattern: 'pan', connectorId: 243 },
  { pattern: 'stone', connectorId: 243 },
  { pattern: 'agibank', connectorId: 1 },
  { pattern: 'cora', connectorId: 1 },
  { pattern: 'will bank', connectorId: 1 },
  { pattern: 'will', connectorId: 1 },
  { pattern: 'next', connectorId: 238 },
  { pattern: 'iti', connectorId: 238 },
  { pattern: 'neon', connectorId: 212 }, // Neon usa infraestrutura do Nubank
  { pattern: 'genial', connectorId: 213 },
  { pattern: 'btg pactual', connectorId: 214 },
  { pattern: 'btg', connectorId: 214 },
  { pattern: 'orama', connectorId: 210 },
  { pattern: 'órama', connectorId: 210 },
  { pattern: 'b3', connectorId: 222 },
  { pattern: 'clear corretora', connectorId: 223 },
  { pattern: 'clear', connectorId: 223 },
  { pattern: 'digio', connectorId: 235 },
  { pattern: 'warren', connectorId: 237 },
  { pattern: 'efi', connectorId: 239 },
  { pattern: 'gerencianet', connectorId: 239 },
  { pattern: 'splitwise', connectorId: 240 },
  { pattern: 'vivo', connectorId: 241 },
  { pattern: 'conta azul', connectorId: 242 },
  { pattern: 'meupluggy', connectorId: 1 },
];

/**
 * Extract bank code from transferNumber
 * Format: "BANK_CODE/AGENCY/ACCOUNT" or "BANK_CODE/AGENCY/ACCOUNT-DIGIT"
 */
export function extractBankCode(transferNumber: string | null | undefined): string | null {
  if (!transferNumber) return null;
  
  const parts = transferNumber.split('/');
  if (parts.length >= 1) {
    return parts[0].trim();
  }
  return null;
}

/**
 * Get Pluggy connector ID from bank code
 */
export function getConnectorIdFromBankCode(bankCode: string | null): number | null {
  if (!bankCode) return null;
  return BANK_CODE_TO_CONNECTOR[bankCode] || null;
}

/**
 * Get Pluggy connector ID from account name using partial matching
 * Checks patterns in order (most specific first)
 */
export function getConnectorIdFromName(accountName: string | null): number | null {
  if (!accountName) {
    console.log(`[Logo Detection] getConnectorIdFromName: accountName is null/empty`);
    return null;
  }
  
  const nameLower = accountName.toLowerCase().trim();
  console.log(`[Logo Detection] getConnectorIdFromName: checking "${accountName}" (normalized: "${nameLower}")`);
  
  // Check each pattern in order (most specific first)
  for (const { pattern, connectorId } of INSTITUTION_NAME_PATTERNS) {
    if (nameLower.includes(pattern)) {
      console.log(`[Logo Detection] ✓ Pattern match: "${accountName}" contains "${pattern}" -> ${connectorId}`);
      return connectorId;
    }
  }
  
  console.log(`[Logo Detection] ✗ No pattern match found for "${accountName}"`);
  return null;
}

/**
 * Build logo URL from connector ID
 */
function buildLogoUrl(connectorId: number): string {
  return `${CONNECTOR_ICON_BASE_URL}/${connectorId}.svg`;
}

/**
 * Get the institution logo URL for an account
 * Tries to determine the connector ID from:
 * 1. Account name pattern matching (most reliable for Open Finance)
 * 2. Bank code in transferNumber (fallback)
 * 3. Fallback to MeuPluggy (1.svg) if nothing found
 */
export function getInstitutionLogoUrl(
  accountName: string | null,
  transferNumber: string | null | undefined
): string {
  let connectorId: number | null = null;
  
  // PRIORITY 1: Try name matching first (more reliable for Open Finance/MeuPluggy)
  // This is because MeuPluggy items all have connector_id 200, but accounts have real names
  if (accountName) {
    connectorId = getConnectorIdFromName(accountName);
    if (connectorId) {
      console.log(`[Logo Detection] Account: "${accountName}", connectorIdFromName: ${connectorId}`);
    }
  }
  
  // PRIORITY 2: Fallback to bank code if name didn't work
  if (!connectorId) {
    const bankCode = extractBankCode(transferNumber);
    connectorId = getConnectorIdFromBankCode(bankCode);
    
    if (bankCode && connectorId) {
      console.log(`[Logo Detection] Account: "${accountName}", transferNumber: ${transferNumber}, bankCode: ${bankCode}, connectorIdFromBank: ${connectorId}`);
    } else if (bankCode && !connectorId) {
      console.log(`[Logo Detection] Account: "${accountName}", bankCode: ${bankCode} found but no mapping`);
    }
  }
  
  // PRIORITY 3: Use fallback if still no connector ID found
  if (!connectorId) {
    connectorId = FALLBACK_CONNECTOR_ID;
    console.log(`[Logo Detection] Using fallback (MeuPluggy) for "${accountName}"`);
  }
  
  const logoUrl = buildLogoUrl(connectorId);
  console.log(`[Logo Detection] Final logo for "${accountName}": ${logoUrl} (connectorId: ${connectorId})`);
  return logoUrl;
}
