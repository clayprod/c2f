/**
 * Data masking utilities for logs and external outputs
 * Masks sensitive data to prevent exposure in logs while maintaining usability
 */

/**
 * Mask email address
 * Example: user@example.com -> u***@e***.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || email === '') {
    return '***';
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return '***';
  }

  const [localPart, domainPart] = parts;
  const domainParts = domainPart.split('.');

  // Mask local part: show first char, rest as ***
  const maskedLocal = localPart.length > 0 ? `${localPart[0]}***` : '***';

  // Mask domain: show first char of domain and TLD
  let maskedDomain = '';
  if (domainParts.length >= 2) {
    const domain = domainParts[0];
    const tld = domainParts[domainParts.length - 1];
    maskedDomain = `${domain.length > 0 ? domain[0] : ''}***.${tld}`;
  } else {
    maskedDomain = `${domainPart[0]}***`;
  }

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask CPF (Brazilian tax ID)
 * Example: 12345678901 -> 123.***.***-01
 */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf || cpf === '') {
    return '***';
  }

  // Remove non-digits
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) {
    return '***';
  }

  // Show first 3 and last 2 digits
  return `${digits.substring(0, 3)}.***.***-${digits.substring(9)}`;
}

/**
 * Mask CNPJ (Brazilian company tax ID)
 * Example: 12345678000190 -> 12.***.*** / ****-90
 */
export function maskCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj || cnpj === '') {
    return '***';
  }

  // Remove non-digits
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) {
    return '***';
  }

  // Show first 2, last 4 and last 2 digits
  return `${digits.substring(0, 2)}.***.***/${digits.substring(8, 12)}-${digits.substring(12)}`;
}

/**
 * Mask bank account number
 * Example: 12345-6 -> 12***-6
 */
export function maskBankAccount(account: string | null | undefined): string {
  if (!account || account === '') {
    return '***';
  }

  // Remove non-alphanumeric except dash
  const cleaned = account.replace(/[^a-zA-Z0-9-]/g, '');

  if (cleaned.length <= 4) {
    return '***';
  }

  // Show first 2 and last 1-2 chars
  const parts = cleaned.split('-');
  if (parts.length === 2) {
    const mainPart = parts[0];
    const suffix = parts[1];
    return `${mainPart.substring(0, 2)}***-${suffix}`;
  }

  return `${cleaned.substring(0, 2)}***${cleaned.substring(cleaned.length - 1)}`;
}

/**
 * Mask credit card number
 * Example: 1234567890123456 -> 1234-****-****-3456
 */
export function maskCreditCard(cardNumber: string | null | undefined): string {
  if (!cardNumber || cardNumber === '') {
    return '****-****-****-****';
  }

  // Remove non-digits
  const digits = cardNumber.replace(/\D/g, '');

  if (digits.length < 13 || digits.length > 19) {
    return '****-****-****-****';
  }

  // Show first 4 and last 4 digits
  const first4 = digits.substring(0, 4);
  const last4 = digits.substring(digits.length - 4);
  const masked = '*'.repeat(Math.max(0, digits.length - 8));

  // Format with dashes
  if (digits.length === 16) {
    return `${first4}-****-****-${last4}`;
  }

  return `${first4}-${masked}-${last4}`;
}

/**
 * Mask monetary value in logs
 * Shows range instead of exact value
 */
export function maskMonetaryValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return '***';
  }

  const amount = Math.abs(cents);
  const ranges = [
    { max: 1000, label: '< R$ 10' },
    { max: 10000, label: 'R$ 10 - R$ 100' },
    { max: 100000, label: 'R$ 100 - R$ 1.000' },
    { max: 1000000, label: 'R$ 1.000 - R$ 10.000' },
    { max: 10000000, label: 'R$ 10.000 - R$ 100.000' },
    { max: Infinity, label: '> R$ 100.000' },
  ];

  const range = ranges.find((r) => amount < r.max);
  return range?.label || '***';
}

/**
 * Mask phone number
 * Example: +5511999999999 -> +55 11 9****-9999
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone === '') {
    return '***';
  }

  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 13) {
    return '***';
  }

  // Brazilian phone format: +55 (country) + 11 (area) + 9****-9999 (number)
  if (digits.length === 13 && digits.startsWith('55')) {
    const country = digits.substring(0, 2);
    const area = digits.substring(2, 4);
    const number = digits.substring(4);
    return `+${country} ${area} ${number.substring(0, 1)}****-${number.substring(5)}`;
  }

  if (digits.length === 11) {
    // Format: (11) 9****-9999
    return `(${digits.substring(0, 2)}) ${digits[2]}****-${digits.substring(7)}`;
  }

  // Generic masking: show first 2 and last 4
  return `${digits.substring(0, 2)}***${digits.substring(digits.length - 4)}`;
}

/**
 * Mask full name
 * Example: João Silva -> J*** S***
 */
export function maskName(name: string | null | undefined): string {
  if (!name || name === '') {
    return '***';
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) {
    return '***';
  }

  return parts
    .map((part) => {
      if (part.length === 0) return '';
      return `${part[0]}***`;
    })
    .join(' ');
}

/**
 * Mask IP address
 * Example: 192.168.1.1 -> 192.168.***.***
 */
export function maskIP(ip: string | null | undefined): string {
  if (!ip || ip === '') {
    return '***';
  }

  const parts = ip.split('.');
  if (parts.length !== 4) {
    return '***';
  }

  return `${parts[0]}.${parts[1]}.***.***`;
}

/**
 * Mask sensitive data in object recursively
 */
export function maskSensitiveFields<T extends Record<string, any>>(
  obj: T,
  fieldMasks: {
    email?: (keyof T)[];
    cpf?: (keyof T)[];
    cnpj?: (keyof T)[];
    bankAccount?: (keyof T)[];
    creditCard?: (keyof T)[];
    phone?: (keyof T)[];
    name?: (keyof T)[];
    ip?: (keyof T)[];
    monetary?: (keyof T)[];
  }
): T {
  const masked = { ...obj };

  // Apply email masking
  if (fieldMasks.email) {
    for (const field of fieldMasks.email) {
      if (field in masked && masked[field]) {
        masked[field] = maskEmail(String(masked[field])) as any;
      }
    }
  }

  // Apply CPF masking
  if (fieldMasks.cpf) {
    for (const field of fieldMasks.cpf) {
      if (field in masked && masked[field]) {
        masked[field] = maskCPF(String(masked[field])) as any;
      }
    }
  }

  // Apply CNPJ masking
  if (fieldMasks.cnpj) {
    for (const field of fieldMasks.cnpj) {
      if (field in masked && masked[field]) {
        masked[field] = maskCNPJ(String(masked[field])) as any;
      }
    }
  }

  // Apply bank account masking
  if (fieldMasks.bankAccount) {
    for (const field of fieldMasks.bankAccount) {
      if (field in masked && masked[field]) {
        masked[field] = maskBankAccount(String(masked[field])) as any;
      }
    }
  }

  // Apply credit card masking
  if (fieldMasks.creditCard) {
    for (const field of fieldMasks.creditCard) {
      if (field in masked && masked[field]) {
        masked[field] = maskCreditCard(String(masked[field])) as any;
      }
    }
  }

  // Apply phone masking
  if (fieldMasks.phone) {
    for (const field of fieldMasks.phone) {
      if (field in masked && masked[field]) {
        masked[field] = maskPhone(String(masked[field])) as any;
      }
    }
  }

  // Apply name masking
  if (fieldMasks.name) {
    for (const field of fieldMasks.name) {
      if (field in masked && masked[field]) {
        masked[field] = maskName(String(masked[field])) as any;
      }
    }
  }

  // Apply IP masking
  if (fieldMasks.ip) {
    for (const field of fieldMasks.ip) {
      if (field in masked && masked[field]) {
        masked[field] = maskIP(String(masked[field])) as any;
      }
    }
  }

  // Apply monetary masking
  if (fieldMasks.monetary) {
    for (const field of fieldMasks.monetary) {
      if (field in masked && masked[field] !== null && masked[field] !== undefined) {
        masked[field] = maskMonetaryValue(Number(masked[field])) as any;
      }
    }
  }

  return masked;
}

