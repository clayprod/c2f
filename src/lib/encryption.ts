/**
 * Encryption utilities for sensitive data
 * Uses AES-256-GCM for encryption and SHA-256 for hashing
 */

import crypto from 'crypto';

// Encryption key from environment variable (32 bytes = 64 hex characters)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Validate encryption key on module load
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.warn(
    '⚠️  ENCRYPTION_KEY not set or invalid. Encryption functions will use a default key (NOT SECURE FOR PRODUCTION).'
  );
}

/**
 * Get encryption key as Buffer
 */
function getEncryptionKey(): Buffer {
  const key = ENCRYPTION_KEY || '0'.repeat(64);
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt text data using AES-256-GCM
 * Returns base64 encoded string: IV (12 bytes) + encrypted data
 */
export function encrypt(data: string | null | undefined): string | null {
  if (data === null || data === undefined || data === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 12 bytes for GCM IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine: IV (12 bytes) + encrypted data + auth tag (16 bytes)
    const combined = Buffer.concat([iv, encrypted, authTag]);

    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt text data using AES-256-GCM
 * Expects base64 encoded string: IV (12 bytes) + encrypted data + auth tag (16 bytes)
 */
export function decrypt(encryptedData: string | null | undefined): string | null {
  if (encryptedData === null || encryptedData === undefined || encryptedData === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(combined.length - 16);
    const encrypted = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Create SHA-256 hash for searchable fields
 * Allows searching without decrypting
 */
export function hash(data: string | null | undefined): string | null {
  if (data === null || data === undefined || data === '') {
    return null;
  }

  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

/**
 * Create partial hash for email search (first 3 chars + domain)
 * Allows partial matching while maintaining privacy
 */
export function hashEmailPartial(email: string | null | undefined): string | null {
  if (!email || email === '') {
    return null;
  }

  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) {
    return hash(email);
  }

  const [localPart, domainPart] = parts;
  const partialLocal = localPart.substring(0, Math.min(3, localPart.length));

  return hash(`${partialLocal}@${domainPart}`);
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Generate a new encryption key (for setup/rotation)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt object fields recursively
 */
export function encryptObjectFields<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (field in encrypted && encrypted[field] !== null && encrypted[field] !== undefined) {
      encrypted[field] = encrypt(String(encrypted[field])) as any;
    }
  }

  return encrypted;
}

/**
 * Decrypt object fields recursively
 */
export function decryptObjectFields<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (field in decrypted && decrypted[field] !== null && decrypted[field] !== undefined) {
      try {
        decrypted[field] = decrypt(String(decrypted[field])) as any;
      } catch (error) {
        console.error(`Failed to decrypt field ${String(field)}:`, error);
        // Keep original value if decryption fails (might be plaintext in migration)
        decrypted[field] = decrypted[field];
      }
    }
  }

  return decrypted;
}






