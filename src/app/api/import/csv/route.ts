import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseCSV } from '@/services/import/csvParser';
import { createErrorResponse } from '@/lib/errors';
import { projectionCache } from '@/services/projections/cache';
import {
  matchTransactions,
  createCategories,
  updateTransactionsWithNewCategories,
  type CategoryToCreate,
} from '@/services/import/categoryMatcher';

const BATCH_SIZE = 500; // Process 500 transactions at a time

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { csv_content, account_id, categories_to_create, selected_ids } = body as {
      csv_content: string;
      account_id?: string;
      categories_to_create?: CategoryToCreate[];
      selected_ids?: string[];
    };

    if (!csv_content) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    // Parse CSV
    console.log(`[CSV Import] Starting import for user ${userId}`);
    console.log(`[CSV Import] CSV content length: ${csv_content.length} characters`);
    
    const allTransactions = parseCSV(csv_content);
    console.log(`[CSV Import] Parsed ${allTransactions.length} transactions from CSV`);
    
    if (allTransactions.length > 0) {
      console.log(`[CSV Import] First transaction sample:`, {
        id: allTransactions[0].id,
        date: allTransactions[0].date,
        description: allTransactions[0].description.substring(0, 50),
        amount: allTransactions[0].amount,
        type: allTransactions[0].type
      });
      console.log(`[CSV Import] Last transaction sample:`, {
        id: allTransactions[allTransactions.length - 1].id,
        date: allTransactions[allTransactions.length - 1].date,
        description: allTransactions[allTransactions.length - 1].description.substring(0, 50),
        amount: allTransactions[allTransactions.length - 1].amount,
        type: allTransactions[allTransactions.length - 1].type
      });
    }

    // Filter by selected_ids if provided
    let transactionsToImport = allTransactions;
    if (selected_ids && selected_ids.length > 0) {
      const selectedSet = new Set(selected_ids);
      console.log(`[CSV Import] selected_ids received: ${selected_ids.length} IDs`);
      console.log(`[CSV Import] First 10 selected_ids:`, selected_ids.slice(0, 10));
      console.log(`[CSV Import] Last 10 selected_ids:`, selected_ids.slice(-10));
      
      transactionsToImport = allTransactions.filter(tx => {
        const isSelected = selectedSet.has(tx.id);
        if (!isSelected) {
          console.log(`[CSV Import] Transaction NOT in selected_ids: ${tx.id}`);
        }
        return isSelected;
      });
      
      console.log(`[CSV Import] Filtered to ${transactionsToImport.length} transactions by selected_ids`);
      
      // Check if there's a mismatch
      if (transactionsToImport.length !== selected_ids.length) {
        console.warn(`[CSV Import] MISMATCH: ${selected_ids.length} IDs sent but only ${transactionsToImport.length} matched`);
        const allIds = new Set(allTransactions.map(tx => tx.id));
        const missingIds = selected_ids.filter(id => !allIds.has(id));
        if (missingIds.length > 0) {
          console.warn(`[CSV Import] Missing IDs (first 10):`, missingIds.slice(0, 10));
        }
      }
    }

    const supabase = await createClient();
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

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

    const totalRows = transactionsToImport.length;

    if (totalRows === 0) {
      await supabase
        .from('imports')
        .update({ status: 'completed', error_message: 'Nenhuma transação selecionada' })
        .eq('id', importRecord.id);

      return NextResponse.json({
        success: true,
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: [],
      });
    }

    // Get or create default account - always use the selected account
    let defaultAccountId = account_id;
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

    // Get existing categories
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId);

    // Step 1: Match transactions with existing categories
    const matchingResult = matchTransactions(
      transactionsToImport.map((tx, index) => ({
        id: tx.id || `csv-${index}`,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        categoryName: tx.categoryName,
        accountName: tx.accountName,
      })),
      existingCategories || [],
      [], // We don't need accounts here, we use the selected one
      defaultAccountId
    );

    // Step 2: Create categories that need to be created
    let finalTransactions = matchingResult.transactions;
    
    if (categories_to_create && categories_to_create.length > 0) {
      try {
        const createdCategoriesMap = await createCategories(
          categories_to_create,
          userId,
          supabase
        );
        
        // Update transactions with newly created category IDs
        finalTransactions = updateTransactionsWithNewCategories(
          matchingResult.transactions,
          createdCategoriesMap
        );
      } catch (error) {
        console.error('Error creating categories:', error);
        errors.push('Erro ao criar algumas categorias');
      }
    }

    // Step 3: Get or create fallback category
    let fallbackCategoryId: string | undefined = undefined;
    const { data: outrosCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', 'outros')
      .maybeSingle();

    if (outrosCategory) {
      fallbackCategoryId = outrosCategory.id;
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
        fallbackCategoryId = newCategory.id;
      }
    }

    // Step 4: Check for existing transactions in batch
    console.log(`[CSV Import] Step 4: Checking for duplicates`);
    
    // Check duplicates in batches to avoid Supabase limits
    const CHECK_BATCH_SIZE = 500;
    const existingIdsSet = new Set<string>();
    const existingContentSet = new Set<string>();
    
    // Get all provider_tx_ids to check for duplicates (in batches)
    const providerTxIds = finalTransactions.map(tx => tx.id);
    console.log(`[CSV Import] Checking ${providerTxIds.length} provider_tx_ids for duplicates in batches of ${CHECK_BATCH_SIZE}`);
    
    for (let i = 0; i < providerTxIds.length; i += CHECK_BATCH_SIZE) {
      const batch = providerTxIds.slice(i, i + CHECK_BATCH_SIZE);
      console.log(`[CSV Import] Checking IDs batch ${Math.floor(i / CHECK_BATCH_SIZE) + 1}/${Math.ceil(providerTxIds.length / CHECK_BATCH_SIZE)} (${batch.length} items)`);
      
      const { data: existingByIds, error: existingIdsError } = await supabase
        .from('transactions')
        .select('provider_tx_id')
        .eq('user_id', userId)
        .in('provider_tx_id', batch);
      
      if (existingIdsError) {
        console.error(`[CSV Import] Error checking existing by IDs batch ${Math.floor(i / CHECK_BATCH_SIZE) + 1}:`, existingIdsError);
      } else {
        existingByIds?.forEach(tx => existingIdsSet.add(tx.provider_tx_id));
      }
    }
    console.log(`[CSV Import] Found ${existingIdsSet.size} duplicates by ID`);

    // Get all transaction content hashes to check for duplicates by content (in batches)
    const contentHashes = finalTransactions.map(tx => ({
      date: tx.date,
      description: tx.description,
      amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
    }));
    
    console.log(`[CSV Import] Checking ${contentHashes.length} content hashes for duplicates in batches of ${CHECK_BATCH_SIZE}`);
    
    for (let i = 0; i < contentHashes.length; i += CHECK_BATCH_SIZE) {
      const batch = contentHashes.slice(i, i + CHECK_BATCH_SIZE);
      console.log(`[CSV Import] Checking content batch ${Math.floor(i / CHECK_BATCH_SIZE) + 1}/${Math.ceil(contentHashes.length / CHECK_BATCH_SIZE)} (${batch.length} items)`);
      
      const { data: existingByContent, error: existingContentError } = await supabase
        .from('transactions')
        .select('posted_at, description, amount')
        .eq('user_id', userId)
        .in('posted_at', batch.map(h => h.date))
        .in('description', batch.map(h => h.description));
      
      if (existingContentError) {
        console.error(`[CSV Import] Error checking existing by content batch ${Math.floor(i / CHECK_BATCH_SIZE) + 1}:`, existingContentError);
      } else {
        existingByContent?.forEach(tx => {
          existingContentSet.add(`${tx.posted_at}|${tx.description}|${tx.amount}`);
        });
      }
    }
    console.log(`[CSV Import] Found ${existingContentSet.size} duplicates by content`);

    // Step 5: Prepare transactions for batch insert
    console.log(`[CSV Import] Step 5: Preparing transactions for insert`);
    console.log(`[CSV Import] finalTransactions count: ${finalTransactions.length}`);
    
    const transactionsToInsert = [];
    let skippedById = 0;
    let skippedByContent = 0;
    
    for (const tx of finalTransactions) {
      const signedAmount = tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
      
      // Check for duplicates by ID
      if (existingIdsSet.has(tx.id)) {
        skipped++;
        skippedById++;
        if (skippedById <= 5) {
          console.log(`[CSV Import] Skipping duplicate by ID: ${tx.id}`);
        }
        continue;
      }

      // Check for duplicates by content
      const contentKey = `${tx.date}|${tx.description}|${signedAmount}`;
      if (existingContentSet.has(contentKey)) {
        skipped++;
        skippedByContent++;
        if (skippedByContent <= 5) {
          console.log(`[CSV Import] Skipping duplicate by content: ${contentKey}`);
        }
        continue;
      }

      transactionsToInsert.push({
        user_id: userId,
        account_id: defaultAccountId,
        category_id: tx.category_id || fallbackCategoryId,
        posted_at: tx.date,
        description: tx.description,
        amount: signedAmount,
        currency: 'BRL',
        source: 'import',
        provider_tx_id: tx.id,
        notes: `Importado via CSV - ${tx.type}`,
      });
    }

    console.log(`[CSV Import] After filtering: ${transactionsToInsert.length} transactions to insert`);
    console.log(`[CSV Import] Skipped by ID: ${skippedById}, Skipped by content: ${skippedByContent}`);

    // Step 6: Batch insert transactions
    const totalToInsert = transactionsToInsert.length;
    console.log(`[CSV Import] Total transactions to insert: ${totalToInsert}`);
    console.log(`[CSV Import] Batch size: ${BATCH_SIZE}`);
    console.log(`[CSV Import] Number of batches: ${Math.ceil(totalToInsert / BATCH_SIZE)}`);
    
    if (transactionsToInsert.length > 0) {
      console.log(`[CSV Import] First transaction to insert:`, {
        id: transactionsToInsert[0].provider_tx_id,
        date: transactionsToInsert[0].posted_at,
        description: transactionsToInsert[0].description.substring(0, 50),
        amount: transactionsToInsert[0].amount
      });
      console.log(`[CSV Import] Last transaction to insert:`, {
        id: transactionsToInsert[transactionsToInsert.length - 1].provider_tx_id,
        date: transactionsToInsert[transactionsToInsert.length - 1].posted_at,
        description: transactionsToInsert[transactionsToInsert.length - 1].description.substring(0, 50),
        amount: transactionsToInsert[transactionsToInsert.length - 1].amount
      });
    }
    
    for (let i = 0; i < totalToInsert; i += BATCH_SIZE) {
      const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalToInsert / BATCH_SIZE);
      
      console.log(`[CSV Import] Processing batch ${batchNumber}/${totalBatches} (${batch.length} transactions)`);
      
      try {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(batch);

        if (insertError) {
          console.error(`[CSV Import] Batch ${batchNumber} insert error:`, insertError);
          console.error(`[CSV Import] Error details:`, {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          errors.push(`Erro ao inserir lote ${batchNumber}: ${insertError.message}`);
          // Continue with next batch
        } else {
          imported += batch.length;
          console.log(`[CSV Import] Batch ${batchNumber} inserted successfully. Total imported: ${imported}/${totalToInsert}`);
        }
      } catch (error: any) {
        console.error(`[CSV Import] Batch ${batchNumber} exception:`, error);
        console.error(`[CSV Import] Exception details:`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        errors.push(`Erro ao inserir lote ${batchNumber}: ${error.message}`);
      }
    }
    
    console.log(`[CSV Import] Import completed. Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors.length}`);

    // Update import record
    const status = errors.length > 0 && imported === 0 ? 'failed' : 'completed';
    await supabase
      .from('imports')
      .update({
        status,
        error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
      })
      .eq('id', importRecord.id);

    projectionCache.invalidateUser(userId);

    return NextResponse.json({
      success: status === 'completed',
      totalRows,
      imported,
      skipped,
      errors: errors.slice(0, 10),
      importId: importRecord.id,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
