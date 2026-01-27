/**
 * Encryption Key Rotation Script
 * 
 * This script rotates the encryption key and re-encrypts all sensitive data.
 * 
 * IMPORTANT: 
 * - Backup database before running
 * - Set new ENCRYPTION_KEY in environment
 * - Run in maintenance window
 * - Verify data integrity after rotation
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt, generateEncryptionKey } from '@/lib/encryption';

interface RotationResult {
  table: string;
  rowsProcessed: number;
  errors: number;
  status: 'success' | 'error' | 'partial';
}

/**
 * Rotate encryption key for a specific table
 */
async function rotateTableData(
  tableName: string,
  encryptedColumns: string[],
  idColumn: string = 'id'
): Promise<RotationResult> {
  const supabase = createAdminClient();
  let rowsProcessed = 0;
  let errors = 0;

  try {
    console.log(`[Rotation] Starting rotation for table: ${tableName}`);

    // Fetch all rows with encrypted data
    const { data: rows, error: fetchError } = await supabase
      .from(tableName)
      .select(`${idColumn}, ${encryptedColumns.join(', ')}`);

    if (fetchError) {
      console.error(`[Rotation] Error fetching ${tableName}:`, fetchError);
      return {
        table: tableName,
        rowsProcessed: 0,
        errors: 1,
        status: 'error',
      };
    }

    if (!rows || rows.length === 0) {
      console.log(`[Rotation] No rows to process in ${tableName}`);
      return {
        table: tableName,
        rowsProcessed: 0,
        errors: 0,
        status: 'success',
      };
    }

    // Process each row
    for (const row of rows) {
      try {
        const rowData = row as Record<string, any>;
        const updates: Record<string, string | null> = {};

        for (const column of encryptedColumns) {
          const encryptedValue = rowData[column] as string | null;

          if (encryptedValue) {
            try {
              // Decrypt with old key (if it fails, might already be using new key)
              const decrypted = decrypt(encryptedValue);

              if (decrypted) {
                // Re-encrypt with new key
                const reEncrypted = encrypt(decrypted);
                updates[column] = reEncrypted;
              }
            } catch (error) {
              // If decryption fails, might already be encrypted with new key
              // Skip this column
              console.warn(
                 `[Rotation] Could not decrypt ${tableName}.${column} for id ${rowData[idColumn]}, skipping`
              );
            }
          }
        }

        // Update row if we have changes
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from(tableName)
            .update(updates)
            .eq(idColumn, rowData[idColumn]);

          if (updateError) {
            console.error(
              `[Rotation] Error updating ${tableName} id ${rowData[idColumn]}:`,
              updateError
            );
            errors++;
          } else {
            rowsProcessed++;
          }
        }
      } catch (error) {
        console.error(`[Rotation] Error processing row in ${tableName}:`, error);
        errors++;
      }
    }

    const status: 'success' | 'error' | 'partial' =
      errors === 0 ? 'success' : rowsProcessed > 0 ? 'partial' : 'error';

    console.log(
      `[Rotation] Completed ${tableName}: ${rowsProcessed} rows processed, ${errors} errors`
    );

    return {
      table: tableName,
      rowsProcessed,
      errors,
      status,
    };
  } catch (error) {
    console.error(`[Rotation] Fatal error for ${tableName}:`, error);
    return {
      table: tableName,
      rowsProcessed,
      errors: 1,
      status: 'error',
    };
  }
}

/**
 * Main rotation function
 */
export async function rotateEncryptionKey(): Promise<RotationResult[]> {
  console.log('[Rotation] Starting encryption key rotation...');
  console.log('[Rotation] WARNING: Ensure new ENCRYPTION_KEY is set in environment');

  // Verify new key is set
  const newKey = process.env.ENCRYPTION_KEY;
  if (!newKey || newKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY not set or invalid. Must be 64 hex characters (32 bytes).'
    );
  }

  console.log('[Rotation] New encryption key is set');

  const results: RotationResult[] = [];

  // Rotate profiles
  results.push(
    await rotateTableData('profiles', [
      'email_encrypted',
      'full_name_encrypted',
      'birth_date_encrypted',
      'cep_encrypted',
      'monthly_income_cents_encrypted',
    ])
  );

  // Rotate transactions
  results.push(
    await rotateTableData('transactions', ['description_encrypted', 'notes_encrypted'])
  );

  // Rotate accounts
  results.push(
    await rotateTableData('accounts', ['name_encrypted', 'institution_encrypted'])
  );

  // Rotate pluggy_accounts
  results.push(
    await rotateTableData('pluggy_accounts', ['number_encrypted', 'name_encrypted'])
  );

  // Rotate pluggy_transactions
  results.push(
    await rotateTableData('pluggy_transactions', ['description_encrypted'])
  );

  // Rotate global_settings
  results.push(
    await rotateTableData('global_settings', [
      'smtp_password_encrypted',
      'pluggy_client_secret_encrypted',
      'groq_api_key_encrypted',
      'openai_api_key_encrypted',
      'evolution_api_key_encrypted',
      'evolution_webhook_secret_encrypted',
      'n8n_api_key_encrypted',
    ])
  );

  // Summary
  const totalRows = results.reduce((sum, r) => sum + r.rowsProcessed, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log('[Rotation] Rotation complete!');
  console.log(`[Rotation] Total rows processed: ${totalRows}`);
  console.log(`[Rotation] Total errors: ${totalErrors}`);

  return results;
}

// Run if executed directly
if (require.main === module) {
  rotateEncryptionKey()
    .then((results) => {
      console.log('Rotation results:', results);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Rotation failed:', error);
      process.exit(1);
    });
}





