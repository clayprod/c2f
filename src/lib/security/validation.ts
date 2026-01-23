/**
 * Security validation and sanitization utilities
 */

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';

  // Remove null bytes and control characters
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim();
}

/**
 * Validate email format
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Validate CPF (Brazilian tax ID) format
 */
export function validateCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;

  // Remove non-digits
  const digits = cpf.replace(/\D/g, '');

  // Must have 11 digits
  if (digits.length !== 11) return false;

  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let checkDigit1 = 11 - (sum % 11);
  if (checkDigit1 >= 10) checkDigit1 = 0;
  if (checkDigit1 !== parseInt(digits.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  let checkDigit2 = 11 - (sum % 11);
  if (checkDigit2 >= 10) checkDigit2 = 0;
  if (checkDigit2 !== parseInt(digits.charAt(10))) return false;

  return true;
}

/**
 * Validate CNPJ (Brazilian company tax ID) format
 */
export function validateCNPJ(cnpj: string | null | undefined): boolean {
  if (!cnpj) return false;

  // Remove non-digits
  const digits = cnpj.replace(/\D/g, '');

  // Must have 14 digits
  if (digits.length !== 14) return false;

  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Validate check digits
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i)) * weights1[i];
  }
  let checkDigit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (checkDigit1 !== parseInt(digits.charAt(12))) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i)) * weights2[i];
  }
  let checkDigit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (checkDigit2 !== parseInt(digits.charAt(13))) return false;

  return true;
}

/**
 * Validate CEP (Brazilian postal code) format
 */
export function validateCEP(cep: string | null | undefined): boolean {
  if (!cep) return false;

  // Remove non-digits
  const digits = cep.replace(/\D/g, '');

  // Must have 8 digits
  return digits.length === 8;
}

/**
 * Validate phone number format (Brazilian)
 */
export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;

  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Must have 10 or 11 digits (with or without country code)
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Validate monetary amount (in cents)
 */
export function validateMonetaryAmount(cents: number | null | undefined): boolean {
  if (cents === null || cents === undefined) return false;
  if (typeof cents !== 'number') return false;
  if (!Number.isInteger(cents)) return false;
  if (cents < 0) return false;

  // Max value: 9,999,999,999,999 cents (about 99 trillion)
  return cents <= 9999999999999;
}

/**
 * Sanitize input before encryption
 */
export function sanitizeForEncryption(input: string | null | undefined): string | null {
  if (!input) return null;

  const sanitized = sanitizeString(input);

  // Max length check (prevent DoS)
  if (sanitized.length > 10000) {
    throw new Error('Input too long for encryption');
  }

  return sanitized;
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  if (!key) return false;

  // Must be 64 hex characters (32 bytes)
  return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Check if string contains potentially malicious content
 */
export function containsMaliciousContent(input: string | null | undefined): boolean {
  if (!input) return false;

  const lowerInput = input.toLowerCase();

  // Check for SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|;|'|"|`)/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check for XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(lowerInput)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize and validate input before storing
 */
export function sanitizeAndValidate(
  input: string | null | undefined,
  options: {
    type?: 'email' | 'cpf' | 'cnpj' | 'cep' | 'phone' | 'text';
    maxLength?: number;
    required?: boolean;
  } = {}
): string | null {
  const { type, maxLength = 1000, required = false } = options;

  if (!input) {
    if (required) {
      throw new Error('Input is required');
    }
    return null;
  }

  // Check for malicious content
  if (containsMaliciousContent(input)) {
    throw new Error('Input contains potentially malicious content');
  }

  // Sanitize
  let sanitized = sanitizeString(input);

  // Check length
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // Type-specific validation
  if (type === 'email' && !validateEmail(sanitized)) {
    throw new Error('Invalid email format');
  }

  if (type === 'cpf' && !validateCPF(sanitized)) {
    throw new Error('Invalid CPF format');
  }

  if (type === 'cnpj' && !validateCNPJ(sanitized)) {
    throw new Error('Invalid CNPJ format');
  }

  if (type === 'cep' && !validateCEP(sanitized)) {
    throw new Error('Invalid CEP format');
  }

  if (type === 'phone' && !validatePhone(sanitized)) {
    throw new Error('Invalid phone format');
  }

  return sanitized;
}

/**
 * Validate user has permission to access encrypted data
 */
export function validateDecryptionPermission(
  userId: string,
  resourceUserId: string | null | undefined,
  isAdmin: boolean = false
): boolean {
  // Admin can access any data (with audit trail)
  if (isAdmin) {
    return true;
  }

  // User can only access their own data
  if (!resourceUserId) {
    return false;
  }

  return userId === resourceUserId;
}

