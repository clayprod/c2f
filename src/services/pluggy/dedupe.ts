import { createHash } from 'crypto';

/**
 * Generate hash for transaction deduplication
 * Uses: date + amount_cents + normalized description
 */
export function generateTransactionHash(
  date: string,
  amountCents: number,
  description: string
): string {
  // Normalize description: lowercase, remove extra spaces, trim
  const normalized = description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const hashInput = `${date}|${amountCents}|${normalized}`;
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Check if transaction already exists by pluggy_transaction_id or hash
 */
export async function transactionExists(
  supabase: any,
  userId: string,
  pluggyTransactionId: string,
  hash: string
): Promise<boolean> {
  const { data } = await supabase
    .from('pluggy_transactions')
    .select('id')
    .eq('user_id', userId)
    .or(`pluggy_transaction_id.eq.${pluggyTransactionId},hash.eq.${hash}`)
    .limit(1)
    .single();

  return !!data;
}

