import { createClient } from '@/lib/supabase/server';
import { parseCSV, type ParsedCSVTransaction } from './csvParser';
import { parseOFX, type OFXData } from './ofxParser';

export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  importId: string;
}

/**
 * Import CSV transactions
 */
export async function importCSVTransactions(
  userId: string,
  csvContent: string,
  accountId?: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  try {
    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .insert({
        user_id: userId,
        status: 'processing',
        file_url: null, // Will be set if file is uploaded
      })
      .select()
      .single();

    if (importError) {
      throw importError;
    }

    // Parse CSV
    const transactions = parseCSV(csvContent);
    const totalRows = transactions.length;

    if (totalRows === 0) {
      await supabase
        .from('imports')
        .update({ status: 'failed', error_message: 'Nenhuma transação válida encontrada no CSV' })
        .eq('id', importRecord.id);

      return {
        success: false,
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: ['Nenhuma transação válida encontrada no CSV'],
        importId: importRecord.id,
      };
    }

    // Get or create default account if not provided
    let defaultAccountId = accountId;
    if (!defaultAccountId) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (accounts) {
        defaultAccountId = accounts.id;
      } else {
        // Create default account
        const { data: newAccount } = await supabase
          .from('accounts')
          .insert({
            user_id: userId,
            name: 'Conta Principal',
            type: 'checking',
            current_balance: 0,
          })
          .select()
          .single();

        if (newAccount) {
          defaultAccountId = newAccount.id;
        }
      }
    }

    if (!defaultAccountId) {
      throw new Error('Não foi possível criar ou encontrar uma conta para importação');
    }

    // Get existing categories or create them
    const categoryMap = new Map<string, string>();
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId);

    if (existingCategories) {
      for (const cat of existingCategories) {
        categoryMap.set(`${cat.name.toLowerCase()}_${cat.type}`, cat.id);
      }
    }

    // Process transactions
    for (const tx of transactions) {
      try {
        // Check for duplicates using provider_tx_id (preferred)
        const { data: existingById } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('provider_tx_id', tx.id)
          .maybeSingle();

        if (existingById) {
          skipped++;
          continue; // Skip duplicate by ID
        }

        // Also check by content as fallback (date + description + amount)
        const { data: existingByContent } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('posted_at', tx.date)
          .eq('description', tx.description)
          .eq('amount', tx.amount)
          .maybeSingle();

        if (existingByContent) {
          skipped++;
          continue; // Skip duplicate by content
        }

        // Get or create category
        const categoryKey = `${tx.categoryName.toLowerCase()}_${tx.type}`;
        let categoryId = categoryMap.get(categoryKey);

        if (!categoryId) {
          const { data: newCategory } = await supabase
            .from('categories')
            .insert({
              user_id: userId,
              name: tx.categoryName,
              type: tx.type,
            })
            .select()
            .single();

          if (newCategory?.id) {
            categoryId = newCategory.id;
            if (categoryId) {
              categoryMap.set(categoryKey, categoryId);
            }
          }
        }

        // Insert transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: defaultAccountId,
            category_id: categoryId || null,
            posted_at: tx.date,
            description: tx.description,
            amount: tx.amount, // Already in reais (numeric)
            currency: 'BRL',
            source: 'csv_import',
            provider_tx_id: tx.id, // For deduplication
          });

        if (txError) {
          errors.push(`Erro ao importar transação ${tx.id}: ${txError.message}`);
          continue;
        }

        imported++;
      } catch (error: any) {
        errors.push(`Erro ao processar transação ${tx.id}: ${error.message}`);
      }
    }

    // Update import record
    let status: 'completed' | 'failed' = 'completed';
    if (errors.length > 0 && imported === 0) {
      status = 'failed';
    } else if (errors.length > 0) {
      status = 'completed'; // Partial success
    }
    
    await supabase
      .from('imports')
      .update({
        status,
        error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      })
      .eq('id', importRecord.id);

    return {
      success: status === 'completed',
      totalRows,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Limit errors
      importId: importRecord.id,
    };
  } catch (error: any) {
    // Try to find and update the most recent processing import record
    const { data: processingImports } = await supabase
      .from('imports')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .order('created_at', { ascending: false })
      .limit(1);

    const processingImportId = processingImports && processingImports.length > 0 ? processingImports[0].id : null;

    if (processingImportId) {
      await supabase
        .from('imports')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', processingImportId);
    }

    return {
      success: false,
      totalRows: 0,
      imported: 0,
      skipped: 0,
      errors: [error.message],
      importId: processingImportId || '',
    };
  }
}

/**
 * Import OFX transactions
 */
export async function importOFXTransactions(
  userId: string,
  ofxContent: string,
  accountId?: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  try {
    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .insert({
        user_id: userId,
        status: 'processing',
        file_url: null,
      })
      .select()
      .single();

    if (importError) {
      throw importError;
    }

    // Parse OFX
    const ofxData = parseOFX(ofxContent);

    if (!ofxData) {
      await supabase
        .from('imports')
        .update({ status: 'failed', error_message: 'Erro ao processar arquivo OFX' })
        .eq('id', importRecord.id);

      return {
        success: false,
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: ['Erro ao processar arquivo OFX. Verifique se o formato está correto.'],
        importId: importRecord.id,
      };
    }

    const totalRows = ofxData.transactions.length;

    if (totalRows === 0) {
      await supabase
        .from('imports')
        .update({ status: 'failed', error_message: 'Nenhuma transação encontrada no arquivo OFX' })
        .eq('id', importRecord.id);

      return {
        success: false,
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: ['Nenhuma transação encontrada no arquivo OFX'],
        importId: importRecord.id,
      };
    }

    // Get or create default account if not provided
    let defaultAccountId = accountId;
    if (!defaultAccountId) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (accounts) {
        defaultAccountId = accounts.id;
      } else {
        // Create default account with OFX info
        const accountName = ofxData.account.accountId
          ? `Conta ${ofxData.account.accountType || 'Importada'} - ${ofxData.account.accountId.slice(-4)}`
          : 'Conta Importada OFX';

        const { data: newAccount } = await supabase
          .from('accounts')
          .insert({
            user_id: userId,
            name: accountName,
            type: 'checking',
            current_balance: ofxData.balance || 0,
            institution: ofxData.account.bankId || null,
          })
          .select()
          .single();

        if (newAccount) {
          defaultAccountId = newAccount.id;
        }
      }
    }

    if (!defaultAccountId) {
      throw new Error('Não foi possível criar ou encontrar uma conta para importação');
    }

    // Get or create "OUTROS" category
    let defaultCategoryId: string | null = null;
    const { data: outrosCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', 'outros')
      .maybeSingle();

    if (outrosCategory) {
      defaultCategoryId = outrosCategory.id;
    } else {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: 'OUTROS',
          type: 'expense',
          icon: '📦',
          color: '#808080',
        })
        .select()
        .single();

      if (newCategory) {
        defaultCategoryId = newCategory.id;
      }
    }

    // Process transactions
    for (const tx of ofxData.transactions) {
      try {
        // Check for duplicates using fitId as provider_tx_id
        const { data: existingById } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('provider_tx_id', tx.fitId)
          .maybeSingle();

        if (existingById) {
          skipped++;
          continue; // Skip duplicate by ID
        }

        // Also check by content as fallback
        const { data: existingByContent } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('posted_at', tx.date)
          .eq('description', tx.description)
          .eq('amount', tx.amount)
          .maybeSingle();

        if (existingByContent) {
          skipped++;
          continue; // Skip duplicate by content
        }

        // Insert transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            account_id: defaultAccountId,
            category_id: defaultCategoryId,
            posted_at: tx.date,
            description: tx.description,
            amount: tx.amount, // OFX already provides signed amounts
            currency: ofxData.account.currency || 'BRL',
            source: 'import',
            provider_tx_id: tx.fitId, // For deduplication
            notes: `Importado via OFX - ${tx.type}`,
          });

        if (txError) {
          errors.push(`Erro ao importar transação ${tx.fitId}: ${txError.message}`);
          continue;
        }

        imported++;
      } catch (error: any) {
        errors.push(`Erro ao processar transação ${tx.fitId}: ${error.message}`);
      }
    }

    // Update import record
    let status: 'completed' | 'failed' = 'completed';
    if (errors.length > 0 && imported === 0) {
      status = 'failed';
    }

    await supabase
      .from('imports')
      .update({
        status,
        error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      })
      .eq('id', importRecord.id);

    return {
      success: status === 'completed',
      totalRows,
      imported,
      skipped,
      errors: errors.slice(0, 10),
      importId: importRecord.id,
    };
  } catch (error: any) {
    // Try to update any processing import record
    const { data: processingImports } = await supabase
      .from('imports')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .order('created_at', { ascending: false })
      .limit(1);

    const processingImportId = processingImports && processingImports.length > 0 ? processingImports[0].id : null;

    if (processingImportId) {
      await supabase
        .from('imports')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', processingImportId);
    }

    return {
      success: false,
      totalRows: 0,
      imported: 0,
      skipped: 0,
      errors: [error.message],
      importId: processingImportId || '',
    };
  }
}

