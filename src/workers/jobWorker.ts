import 'module-alias/register';
import { Worker } from 'bullmq';
import { getRedisConnection } from '../lib/queue/redis';
import { jobQueueName } from '../lib/queue/jobQueue';
import { getAdminClient } from '../lib/supabase/admin';
import { parseCSV, ParsedCSVTransaction } from '../services/import/csvParser';
import { parseOFX } from '../services/import/ofxParser';
import { parseInstallment, formatInstallmentDescription, removeInstallmentPattern } from '../lib/utils/installmentParser';
import { isCreditCardExpired } from '../lib/utils';
import {
  buildFinancialContextWithClient,
  getOrCreateSession,
  addMessage,
  updateSession,
  optimizeHistory,
  getAdvisorResponse,
  getMaxHistoryTokens,
  hashContext,
  type ChatMessage,
} from '../services/advisor';
import { projectionCache } from '../services/projections/cache';

interface CsvImportOptions {
  account_id?: string | null;
  categories?: Record<string, string>;
  categories_to_create?: Array<{ name: string; type: 'income' | 'expense' }>;
  selected_ids?: string[];
}

interface CsvImportPayload {
  storage_bucket: string;
  storage_path: string;
  original_filename?: string | null;
  options?: CsvImportOptions;
}

interface OfxImportPayload {
  storage_bucket: string;
  storage_path: string;
  options?: {
    account_id?: string | null;
    categories?: Record<string, string>;
    selected_ids?: string[];
  };
}

interface CategoryMigrationPayload {
  source_category_id: string;
  target_category_id: string;
  user_id: string;
}

interface OpenFinancePayload {
  link_id: string;
  transactions: Array<{ id: string; category_id?: string | null }>;
}

interface AdvisorTaskPayload {
  user_id: string;
  owner_id: string;
  message: string;
  session_id: string;
}

interface ManualTransactionPayload {
  owner_id: string;
  user_id: string;
  data: Record<string, any>;
}

const INSERT_BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE) || 200;
const CHECK_BATCH_SIZE = 500;

async function updateJob(jobId: string, update: Record<string, any>) {
  const supabase = getAdminClient();
  await (supabase as any)
    .from('jobs')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function appendJobError(jobId: string, batch: number, message: string) {
  const supabase = getAdminClient();
  await (supabase as any)
    .from('job_errors')
    .insert({ job_id: jobId, batch, error_message: message });
}

async function getDefaultAccountId(userId: string, accountId?: string | null) {
  const supabase = getAdminClient();

  if (accountId) {
    return accountId;
  }

  const { data: account } = (await (supabase as any)
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single()) as { data: { id: string } | null };

  if (account?.id) {
    return account.id;
  }

  const { data: newAccount } = (await (supabase as any)
    .from('accounts')
    .insert({
      user_id: userId,
      name: 'Conta Principal',
      type: 'checking',
      current_balance: 0,
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  return newAccount?.id || null;
}

async function getFallbackCategoryId(userId: string) {
  const supabase = getAdminClient();

  const { data: existing } = (await (supabase as any)
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', 'outros')
    .maybeSingle()) as { data: { id: string } | null };

  if (existing?.id) {
    return existing.id;
  }

  const { data: created } = (await (supabase as any)
    .from('categories')
    .insert({
      user_id: userId,
      name: 'OUTROS',
      type: 'expense',
      icon: '📦',
      color: '#808080',
    })
    .select('id')
    .single()) as { data: { id: string } | null };

  return created?.id || null;
}

async function createCategories(
  userId: string,
  categories: Array<{ name: string; type: 'income' | 'expense' }>
) {
  if (!categories.length) {
    return new Map<string, string>();
  }

  const colorPalette = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'];
  const getRandomColor = () => colorPalette[Math.floor(Math.random() * colorPalette.length)];

  const supabase = getAdminClient();
  const insertData = categories.map(cat => ({
    user_id: userId,
    name: cat.name,
    type: cat.type,
    icon: cat.type === 'income' ? '💰' : '💸',
    color: getRandomColor(),
  }));

  const { data, error } = (await (supabase as any)
    .from('categories')
    .insert(insertData)
    .select('id, name, type')) as {
    data: Array<{ id: string; name: string; type: 'income' | 'expense' }> | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, string>();
  (data || []).forEach(cat => {
    const key = `${cat.name.toLowerCase().trim()}_${cat.type}`;
    map.set(key, cat.id);
  });

  return map;
}

function applyCategoryMappings(
  transactions: ParsedCSVTransaction[],
  categoryMappings: Record<string, string>,
  createdCategoryMap: Map<string, string>
) {
  return transactions.map(tx => {
    const mappedCategory = categoryMappings[tx.id];
    if (mappedCategory) {
      return { ...tx, category_id: mappedCategory } as ParsedCSVTransaction & { category_id?: string };
    }

    if (tx.categoryName) {
      const key = `${tx.categoryName.toLowerCase().trim()}_${tx.type}`;
      const createdCategoryId = createdCategoryMap.get(key);
      if (createdCategoryId) {
        return { ...tx, category_id: createdCategoryId } as ParsedCSVTransaction & { category_id?: string };
      }
    }

    return tx as ParsedCSVTransaction & { category_id?: string };
  });
}

async function runCsvImport(jobId: string, userId: string, payload: CsvImportPayload) {
  const supabase = getAdminClient();

  const { data: fileData, error: fileError } = await supabase.storage
    .from(payload.storage_bucket)
    .download(payload.storage_path);

  if (fileError || !fileData) {
    await updateJob(jobId, { status: 'failed', error_summary: fileError?.message || 'Arquivo não encontrado' });
    return;
  }

  const csvContent = await fileData.text();
  const allTransactions = parseCSV(csvContent);
  const options = payload.options || {};
  const selectedIds = options.selected_ids || [];
  const categoryMappings = options.categories || {};
  const categoriesToCreate = options.categories_to_create || [];

  let transactionsToImport = allTransactions;
  if (selectedIds.length > 0) {
    const selectedSet = new Set(selectedIds);
    transactionsToImport = allTransactions.filter(tx => selectedSet.has(tx.id));
  }

  const totalRows = transactionsToImport.length;
  await updateJob(jobId, { progress: { processed: 0, total: totalRows, imported: 0, skipped: 0 } });

  if (totalRows === 0) {
    await updateJob(jobId, { status: 'completed', error_summary: 'Nenhuma transação selecionada' });
    return;
  }

  const defaultAccountId = await getDefaultAccountId(userId, options.account_id || null);
  if (!defaultAccountId) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Conta padrão não encontrada' });
    return;
  }

  let createdCategoryMap = new Map<string, string>();
  if (categoriesToCreate.length > 0) {
    createdCategoryMap = await createCategories(userId, categoriesToCreate);
  }

  const mappedTransactions = applyCategoryMappings(transactionsToImport, categoryMappings, createdCategoryMap);
  const fallbackCategoryId = await getFallbackCategoryId(userId);

  const existingIdsSet = new Set<string>();
  const providerTxIds = mappedTransactions.map(tx => tx.id);

  for (let i = 0; i < providerTxIds.length; i += CHECK_BATCH_SIZE) {
    const batch = providerTxIds.slice(i, i + CHECK_BATCH_SIZE);
    const { data: existingByIds } = (await (supabase as any)
      .from('transactions')
      .select('provider_tx_id')
      .eq('user_id', userId)
      .in('provider_tx_id', batch)) as {
      data: Array<{ provider_tx_id: string }> | null;
    };

    existingByIds?.forEach(tx => existingIdsSet.add(tx.provider_tx_id));
  }

  const existingContentSet = new Set<string>();
  const contentHashes = mappedTransactions.map(tx => ({
    date: tx.date,
    description: tx.description,
    amount: tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
  }));

  for (let i = 0; i < contentHashes.length; i += CHECK_BATCH_SIZE) {
    const batch = contentHashes.slice(i, i + CHECK_BATCH_SIZE);
    const { data: existingByContent } = (await (supabase as any)
      .from('transactions')
      .select('posted_at, description, amount')
      .eq('user_id', userId)
      .in('posted_at', batch.map(h => h.date))
      .in('description', batch.map(h => h.description))) as {
      data: Array<{ posted_at: string; description: string; amount: number }> | null;
    };

    existingByContent?.forEach(tx => {
      existingContentSet.add(`${tx.posted_at}|${tx.description}|${tx.amount}`);
    });
  }

  const transactionsToInsert: Array<Record<string, any>> = [];
  let skippedById = 0;
  let skippedByContent = 0;

  for (const tx of mappedTransactions) {
    const signedAmount = tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    if (existingIdsSet.has(tx.id)) {
      skippedById++;
      continue;
    }

    const contentKey = `${tx.date}|${tx.description}|${signedAmount}`;
    if (existingContentSet.has(contentKey)) {
      skippedByContent++;
      continue;
    }

    const categoryId = (tx as any).category_id || fallbackCategoryId;
    transactionsToInsert.push({
      user_id: userId,
      account_id: defaultAccountId,
      category_id: categoryId,
      posted_at: tx.date,
      description: tx.description,
      amount: signedAmount,
      currency: 'BRL',
      source: 'import',
      provider_tx_id: tx.id,
      notes: `Importado via CSV - ${tx.type}`,
    });
  }

  let imported = 0;
  const skipped = skippedById + skippedByContent;
  const errors: string[] = [];
  const totalToInsert = transactionsToInsert.length;

  for (let i = 0; i < totalToInsert; i += INSERT_BATCH_SIZE) {
    const batch = transactionsToInsert.slice(i, i + INSERT_BATCH_SIZE);
    const batchNumber = Math.floor(i / INSERT_BATCH_SIZE) + 1;

    const { error: insertError } = await (supabase as any)
      .from('transactions')
      .insert(batch);

    if (insertError) {
      const message = `Erro ao inserir lote ${batchNumber}: ${insertError.message}`;
      errors.push(message);
      await appendJobError(jobId, batchNumber, message);
    } else {
      imported += batch.length;
    }

    const processed = Math.min(i + batch.length, totalToInsert);
    await updateJob(jobId, {
      progress: {
        processed,
        total: totalRows,
        imported,
        skipped,
      },
      error_summary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    });

    if (batch.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const status = errors.length > 0 && imported === 0 ? 'failed' : 'completed';
  await updateJob(jobId, {
    status,
    progress: {
      processed: totalRows,
      total: totalRows,
      imported,
      skipped,
    },
    error_summary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
  });

  projectionCache.invalidateUser(userId);

  if (String(process.env.IMPORT_DELETE_AFTER || 'true').toLowerCase() !== 'false') {
    await supabase.storage.from(payload.storage_bucket).remove([payload.storage_path]);
  }
}

async function runOfxImport(jobId: string, userId: string, payload: OfxImportPayload) {
  const supabase = getAdminClient();

  const { data: fileData, error: fileError } = await supabase.storage
    .from(payload.storage_bucket)
    .download(payload.storage_path);

  if (fileError || !fileData) {
    await updateJob(jobId, { status: 'failed', error_summary: fileError?.message || 'Arquivo não encontrado' });
    return;
  }

  const ofxContent = await fileData.text();
  const ofxData = parseOFX(ofxContent);
  if (!ofxData) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Erro ao processar arquivo OFX' });
    return;
  }

  const options = payload.options || {};
  const selectedIds = options.selected_ids || [];
  let transactionsToImport = ofxData.transactions;
  if (selectedIds.length > 0) {
    const selectedSet = new Set(selectedIds);
    transactionsToImport = ofxData.transactions.filter(tx => selectedSet.has(tx.fitId));
  }

  const totalRows = transactionsToImport.length;
  await updateJob(jobId, { progress: { processed: 0, total: totalRows, imported: 0, skipped: 0 } });

  if (totalRows === 0) {
    await updateJob(jobId, { status: 'completed', error_summary: 'Nenhuma transação selecionada' });
    return;
  }

  const defaultAccountId = await getDefaultAccountId(userId, options.account_id || null);
  if (!defaultAccountId) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Conta padrão não encontrada' });
    return;
  }

  const fallbackCategoryId = await getFallbackCategoryId(userId);
  const categoryMappings = options.categories || {};

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < transactionsToImport.length; i += INSERT_BATCH_SIZE) {
    const batch = transactionsToImport.slice(i, i + INSERT_BATCH_SIZE);
    const batchNumber = Math.floor(i / INSERT_BATCH_SIZE) + 1;

    const insertBatch = [] as Array<Record<string, any>>;
    for (const tx of batch) {
      const { data: existing } = (await (supabase as any)
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('provider_tx_id', tx.fitId)
        .maybeSingle()) as { data: { id: string } | null };

      if (existing) {
        skipped++;
        continue;
      }

      const categoryId = categoryMappings[tx.fitId] || fallbackCategoryId;
      insertBatch.push({
        user_id: userId,
        account_id: defaultAccountId,
        category_id: categoryId,
        posted_at: tx.date,
        description: tx.description,
        amount: tx.amount,
        currency: ofxData.account.currency || 'BRL',
        source: 'import',
        provider_tx_id: tx.fitId,
        notes: `Importado via OFX - ${tx.type}`,
      });
    }

    if (insertBatch.length > 0) {
      const { error: insertError } = await (supabase as any)
        .from('transactions')
        .insert(insertBatch);

      if (insertError) {
        const message = `Erro ao inserir lote ${batchNumber}: ${insertError.message}`;
        errors.push(message);
        await appendJobError(jobId, batchNumber, message);
      } else {
        imported += insertBatch.length;
      }
    }

    const processed = Math.min(i + batch.length, totalRows);
    await updateJob(jobId, {
      progress: { processed, total: totalRows, imported, skipped },
      error_summary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    });
  }

  const status = errors.length > 0 && imported === 0 ? 'failed' : 'completed';
  await updateJob(jobId, {
    status,
    progress: { processed: totalRows, total: totalRows, imported, skipped },
    error_summary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
  });

  projectionCache.invalidateUser(userId);

  if (String(process.env.IMPORT_DELETE_AFTER || 'true').toLowerCase() !== 'false') {
    await supabase.storage.from(payload.storage_bucket).remove([payload.storage_path]);
  }
}

async function runCategoryMigration(jobId: string, payload: CategoryMigrationPayload) {
  const supabase = getAdminClient();
  const { source_category_id, target_category_id, user_id } = payload;

  const { data: targetCategory } = (await (supabase as any)
    .from('categories')
    .select('id, is_active')
    .eq('id', target_category_id)
    .eq('user_id', user_id)
    .single()) as { data: { id: string; is_active: boolean } | null };

  if (!targetCategory || !targetCategory.is_active) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Categoria destino inválida' });
    return;
  }

  const { count: total } = await (supabase as any)
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', source_category_id)
    .eq('user_id', user_id);

  const totalRows = total || 0;
  await updateJob(jobId, { progress: { processed: 0, total: totalRows } });

  if (!totalRows) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Sem transações para migrar' });
    return;
  }

  let processed = 0;
  let batchNumber = 0;
  while (processed < totalRows) {
    batchNumber += 1;
    const { data: batch, error: batchError } = (await (supabase as any)
      .from('transactions')
      .select('id')
      .eq('category_id', source_category_id)
      .eq('user_id', user_id)
      .limit(INSERT_BATCH_SIZE)) as { data: Array<{ id: string }> | null; error: { message: string } | null };

    if (batchError) {
      const message = `Erro ao buscar lote ${batchNumber}: ${batchError.message}`;
      await appendJobError(jobId, batchNumber, message);
      await updateJob(jobId, { status: 'failed', error_summary: message });
      return;
    }

    if (!batch || batch.length === 0) {
      break;
    }

    const ids = batch.map(tx => tx.id);
    const { error: updateError } = await (supabase as any)
      .from('transactions')
      .update({ category_id: target_category_id })
      .in('id', ids)
      .eq('user_id', user_id);

    if (updateError) {
      const message = `Erro ao atualizar lote ${batchNumber}: ${updateError.message}`;
      await appendJobError(jobId, batchNumber, message);
      await updateJob(jobId, { status: 'failed', error_summary: message });
      return;
    }

    processed += batch.length;
    await updateJob(jobId, { progress: { processed, total: totalRows } });
  }

  await updateJob(jobId, { status: 'completed', progress: { processed: totalRows, total: totalRows } });
}

async function getOrCreateFallbackCategory(supabase: any, userId: string): Promise<string | null> {
  const { data: outrosCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', 'outros')
    .maybeSingle();

  if (outrosCategory) {
    return outrosCategory.id;
  }

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

  return newCategory?.id || null;
}

async function importRegularTransactions(
  supabase: any,
  userId: string,
  accountId: string,
  pluggyTransactions: any[],
  categoryMap: Map<string, string | null | undefined>,
  fallbackCategoryId: string | null
) {
  const results = {
    imported: 0,
    skipped: 0,
    bill_items_created: 0,
    errors: [] as string[],
  };

  for (const pluggyTx of pluggyTransactions) {
    try {
      const requestedCategoryId = categoryMap.get(pluggyTx.id);
      const categoryId = requestedCategoryId || fallbackCategoryId;

      const amountCents = Number(pluggyTx.amount_cents) || 0;
      const signedAmountCents = pluggyTx.type === 'debit' ? -Math.abs(amountCents) : Math.abs(amountCents);
      const signedAmountReais = signedAmountCents / 100;

      const { data: newTx, error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          account_id: accountId,
          category_id: categoryId,
          posted_at: pluggyTx.date,
          description: pluggyTx.description,
          amount: signedAmountReais,
          currency: pluggyTx.currency || 'BRL',
          source: 'pluggy',
          provider_tx_id: pluggyTx.pluggy_transaction_id,
          notes: `Importado via Open Finance - ${pluggyTx.type === 'debit' ? 'despesa' : 'receita'}`,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          results.skipped++;
        } else {
          results.errors.push(`Erro ao importar: ${pluggyTx.description} - ${insertError.message}`);
        }
        continue;
      }

      await supabase
        .from('pluggy_transactions')
        .update({
          imported_at: new Date().toISOString(),
          imported_transaction_id: newTx?.id,
        })
        .eq('id', pluggyTx.id);

      results.imported++;
    } catch (error: any) {
      results.errors.push(`Erro ao importar: ${pluggyTx.description}`);
    }
  }

  return results;
}

async function importCreditCardTransactions(
  supabase: any,
  userId: string,
  accountId: string,
  cardAccount: any,
  pluggyTransactions: any[],
  categoryMap: Map<string, string | null | undefined>,
  fallbackCategoryId: string | null
) {
  const results = {
    imported: 0,
    skipped: 0,
    bill_items_created: 0,
    errors: [] as string[],
  };

  const closingDay = cardAccount.closing_day || 10;
  const dueDay = cardAccount.due_day || closingDay + 10;

  for (const pluggyTx of pluggyTransactions) {
    try {
      const requestedCategoryId = categoryMap.get(pluggyTx.id);
      const categoryId = requestedCategoryId || fallbackCategoryId;

      const installmentInfo = parseInstallment(pluggyTx.description);
      const amountCents = Number(pluggyTx.amount_cents) || 0;

      if (installmentInfo && installmentInfo.totalInstallments > 1) {
        const itemsCreated = await createInstallmentBillItems(
          supabase,
          userId,
          accountId,
          pluggyTx,
          categoryId,
          installmentInfo,
          closingDay,
          dueDay,
          amountCents
        );

        if (itemsCreated > 0) {
          results.bill_items_created += itemsCreated;
          results.imported++;
          await supabase
            .from('pluggy_transactions')
            .update({ imported_at: new Date().toISOString() })
            .eq('id', pluggyTx.id);
        } else {
          results.skipped++;
        }
      } else {
        const success = await createSingleBillItem(
          supabase,
          userId,
          accountId,
          pluggyTx,
          categoryId,
          closingDay,
          dueDay,
          amountCents
        );

        if (success) {
          results.bill_items_created++;
          results.imported++;
          await supabase
            .from('pluggy_transactions')
            .update({ imported_at: new Date().toISOString() })
            .eq('id', pluggyTx.id);
        } else {
          results.skipped++;
        }
      }
    } catch (error: any) {
      results.errors.push(`Erro ao importar: ${pluggyTx.description} - ${error.message}`);
    }
  }

  return results;
}

async function createInstallmentBillItems(
  supabase: any,
  userId: string,
  accountId: string,
  pluggyTx: any,
  categoryId: string | null,
  installmentInfo: { currentInstallment: number; totalInstallments: number },
  closingDay: number,
  dueDay: number,
  totalAmountCents: number
) {
  const { currentInstallment, totalInstallments } = installmentInfo;
  const amountPerInstallmentCents = Math.round(totalAmountCents / totalInstallments);
  const txDate = new Date(pluggyTx.date);
  const baseMonth = calculateBillMonth(txDate, closingDay);
  const cleanDescription = removeInstallmentPattern(pluggyTx.description);

  let itemsCreated = 0;
  let parentId: string | null = null;

  for (let i = currentInstallment; i <= totalInstallments; i++) {
    const monthOffset = i - currentInstallment;
    const targetMonth = new Date(baseMonth);
    targetMonth.setMonth(targetMonth.getMonth() + monthOffset);

    const bill = await getOrCreateBill(supabase, userId, accountId, targetMonth, closingDay, dueDay);
    if (!bill) {
      continue;
    }

    const providerTxId = `${pluggyTx.pluggy_transaction_id}_inst_${i}`;
    const { data: existing } = await supabase
      .from('credit_card_bill_items')
      .select('id')
      .eq('user_id', userId)
      .eq('provider_tx_id', providerTxId)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const itemData: any = {
      user_id: userId,
      account_id: accountId,
      bill_id: bill.id,
      category_id: categoryId,
      posted_at: bill.reference_month,
      description: formatInstallmentDescription(cleanDescription, i, totalInstallments),
      amount_cents: amountPerInstallmentCents,
      currency: pluggyTx.currency || 'BRL',
      source: 'pluggy',
      provider_tx_id: providerTxId,
      installment_number: i,
      installment_total: totalInstallments,
      notes: `Importado via Open Finance - Parcela ${i}/${totalInstallments}`,
    };

    if (parentId) {
      itemData.installment_parent_id = parentId;
    }

    const { data: newItem, error: insertError } = await supabase
      .from('credit_card_bill_items')
      .insert(itemData)
      .select('id')
      .single();

    if (insertError) {
      continue;
    }

    if (!parentId && newItem) {
      parentId = newItem.id;
    }

    itemsCreated++;
    await recalculateBillTotal(supabase, bill.id);
  }

  return itemsCreated;
}

async function createSingleBillItem(
  supabase: any,
  userId: string,
  accountId: string,
  pluggyTx: any,
  categoryId: string | null,
  closingDay: number,
  dueDay: number,
  amountCents: number
) {
  const txDate = new Date(pluggyTx.date);
  const targetMonth = calculateBillMonth(txDate, closingDay);

  const bill = await getOrCreateBill(supabase, userId, accountId, targetMonth, closingDay, dueDay);
  if (!bill) {
    return false;
  }

  const { data: existing } = await supabase
    .from('credit_card_bill_items')
    .select('id')
    .eq('user_id', userId)
    .eq('provider_tx_id', pluggyTx.pluggy_transaction_id)
    .maybeSingle();

  if (existing) {
    return false;
  }

  const { error: insertError } = await supabase
    .from('credit_card_bill_items')
    .insert({
      user_id: userId,
      account_id: accountId,
      bill_id: bill.id,
      category_id: categoryId,
      posted_at: pluggyTx.date,
      description: pluggyTx.description,
      amount_cents: amountCents,
      currency: pluggyTx.currency || 'BRL',
      source: 'pluggy',
      provider_tx_id: pluggyTx.pluggy_transaction_id,
      notes: 'Importado via Open Finance',
    });

  if (insertError) {
    return false;
  }

  await recalculateBillTotal(supabase, bill.id);
  return true;
}

function calculateBillMonth(txDate: Date, closingDay: number) {
  const day = txDate.getDate();
  const month = txDate.getMonth();
  const year = txDate.getFullYear();

  if (day > closingDay) {
    const nextMonth = new Date(year, month + 1, 1);
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
  }

  return new Date(year, month, 1);
}

async function getOrCreateBill(
  supabase: any,
  userId: string,
  accountId: string,
  referenceMonth: Date,
  closingDay: number,
  dueDay: number
) {
  const refMonthStr = referenceMonth.toISOString().split('T')[0];

  const { data: existingBill } = await supabase
    .from('credit_card_bills')
    .select('id, reference_month')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('reference_month', refMonthStr)
    .maybeSingle();

  if (existingBill) {
    return existingBill;
  }

  const year = referenceMonth.getFullYear();
  const month = referenceMonth.getMonth();
  const closingDate = new Date(year, month, Math.min(closingDay, getDaysInMonth(year, month)));
  const dueDateMonth = dueDay > closingDay ? month : month + 1;
  const dueDateYear = dueDateMonth > 11 ? year + 1 : year;
  const adjustedDueDateMonth = dueDateMonth > 11 ? 0 : dueDateMonth;
  const dueDate = new Date(dueDateYear, adjustedDueDateMonth, Math.min(dueDay, getDaysInMonth(dueDateYear, adjustedDueDateMonth)));

  const { data: newBill, error } = await supabase
    .from('credit_card_bills')
    .insert({
      user_id: userId,
      account_id: accountId,
      reference_month: refMonthStr,
      closing_date: closingDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      status: 'open',
      total_cents: 0,
      paid_cents: 0,
    })
    .select('id, reference_month')
    .single();

  if (error) {
    return null;
  }

  return newBill;
}

async function recalculateBillTotal(supabase: any, billId: string) {
  await supabase.rpc('recalculate_credit_card_bill', { p_bill_id: billId });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

async function runOpenFinanceImport(jobId: string, userId: string, payload: OpenFinancePayload) {
  const supabase = getAdminClient();

  const { data: link, error: linkError } = await supabase
    .from('account_links')
    .select(`
      internal_account_id,
      pluggy_accounts!inner (
        type,
        subtype
      ),
      accounts!inner (
        id,
        type,
        closing_day,
        due_day
      )
    `)
    .eq('id', payload.link_id)
    .eq('user_id', userId)
    .single();

  if (linkError || !link) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Link não encontrado' });
    return;
  }

  const internalAccount = link.accounts as any;
  const pluggyAccount = link.pluggy_accounts as any;
  const internalAccountId = link.internal_account_id as string;

  const isCreditCard =
    internalAccount.type === 'credit_card' ||
    internalAccount.type === 'credit' ||
    pluggyAccount.type === 'CREDIT' ||
    pluggyAccount.subtype === 'credit_card';

  const transactionIds = payload.transactions.map(t => t.id);
  const { data: pluggyTransactions, error: txError } = await supabase
    .from('pluggy_transactions')
    .select('*')
    .eq('user_id', userId)
    .in('id', transactionIds)
    .is('imported_at', null);

  if (txError) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Falha ao buscar transações' });
    return;
  }

  if (!pluggyTransactions || pluggyTransactions.length === 0) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Nenhuma transação válida para importar' });
    return;
  }

  const fallbackCategoryId = await getOrCreateFallbackCategory(supabase, userId);
  const categoryMap = new Map(payload.transactions.map(t => [t.id, t.category_id]));

  let results: {
    imported: number;
    skipped: number;
    bill_items_created: number;
    errors: string[];
    transfers_detected?: number;
  };
  if (isCreditCard) {
    results = await importCreditCardTransactions(
      supabase,
      userId,
      internalAccountId,
      internalAccount,
      pluggyTransactions,
      categoryMap,
      fallbackCategoryId
    );
  } else {
    results = await importRegularTransactions(
      supabase,
      userId,
      internalAccountId,
      pluggyTransactions,
      categoryMap,
      fallbackCategoryId
    );
  }

  if (!isCreditCard && results.imported > 0) {
    try {
      const dates = pluggyTransactions.map((tx: any) => new Date(tx.date));
      const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
      const { data: detectResult } = await supabase.rpc('auto_detect_transfers', {
        p_user_id: userId,
        p_start_date: minDate.toISOString().split('T')[0],
        p_end_date: maxDate.toISOString().split('T')[0],
      });
      results.transfers_detected = detectResult?.detected_count || 0;
    } catch {
      // ignore auto-detect errors
    }
  }

  await updateJob(jobId, {
    status: 'completed',
    progress: {
      processed: pluggyTransactions.length,
      total: pluggyTransactions.length,
      imported: results.imported,
      skipped: results.skipped,
      bill_items_created: results.bill_items_created,
      transfers_detected: results.transfers_detected || 0,
    },
    error_summary: results.errors.length > 0 ? results.errors.slice(0, 5).join('; ') : null,
  });

  projectionCache.invalidateUser(userId);
}

async function runAdvisorTask(jobId: string, payload: AdvisorTaskPayload) {
  const supabase = getAdminClient();
  const { user_id, owner_id, message, session_id } = payload;

  const session = await getOrCreateSession(user_id, session_id);
  const context = await buildFinancialContextWithClient(supabase, owner_id);
  const contextJson = JSON.stringify(context, null, 2);
  const newContextHash = hashContext(context);

  if (session.contextHash !== newContextHash) {
    session.contextHash = newContextHash;
  }

  const maxTokens = await getMaxHistoryTokens();
  let sessionMessages = session.messages;
  if (session.tokenCount > maxTokens) {
    sessionMessages = await optimizeHistory(session, maxTokens);
    await updateSession(user_id, session.id, {
      messages: sessionMessages,
      tokenCount: sessionMessages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0),
    });
  }

  let conversationHistory: ChatMessage[] = [];
  if (sessionMessages.length > 0) {
    conversationHistory = sessionMessages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));
  } else if (session_id) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentInsights } = await supabase
      .from('advisor_insights')
      .select('summary, metadata, created_at')
      .eq('user_id', owner_id)
      .eq('insight_type', 'chat')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(10);

    if (recentInsights && recentInsights.length > 0) {
      for (const insight of recentInsights) {
        const userMessage = (insight.metadata as any)?.user_message;
        if (userMessage) {
          conversationHistory.push({ role: 'user', content: userMessage });
        }
        conversationHistory.push({ role: 'assistant', content: insight.summary });
      }
    }
  }

  const advisorResponse = await getAdvisorResponse(
    message,
    contextJson,
    conversationHistory,
    owner_id
  );

  await addMessage(user_id, session.id, { role: 'user', content: message });
  await addMessage(user_id, session.id, { role: 'assistant', content: JSON.stringify(advisorResponse) });

  try {
    const { error: insertError } = await supabase.from('advisor_insights').insert({
      user_id: owner_id,
      summary: advisorResponse.summary,
      insights: advisorResponse.insights,
      actions: advisorResponse.actions,
      confidence: advisorResponse.confidence,
      citations: advisorResponse.citations,
      insight_type: 'chat',
      metadata: {
        user_message: message,
        session_id: session.id,
        member_id: user_id,
      },
    });

    if (insertError) {
      if (insertError.code === '42703' || insertError.message?.includes('insight_type') || insertError.message?.includes('metadata')) {
        await supabase.from('advisor_insights').insert({
          user_id: owner_id,
          summary: advisorResponse.summary,
          insights: advisorResponse.insights,
          actions: advisorResponse.actions,
          confidence: advisorResponse.confidence,
          citations: advisorResponse.citations,
        });
      }
    }
  } catch {
    // ignore save errors
  }

  await updateJob(jobId, {
    status: 'completed',
    progress: {
      processed: 1,
      total: 1,
      result: advisorResponse,
      sessionId: session.id,
    },
  });
}

async function updateCreditCardBillTotals(supabase: any, accountId: string) {
  const { data: bills } = await supabase
    .from('credit_card_bills')
    .select('id')
    .eq('account_id', accountId)
    .in('status', ['open', 'closed']);

  if (!bills) return;

  for (const bill of bills) {
    const { data: billItems } = await supabase
      .from('credit_card_bill_items')
      .select('amount_cents')
      .eq('bill_id', bill.id);

    const total = (billItems || [])
      .reduce((sum: number, item: { amount_cents: number }) => sum + (item.amount_cents || 0), 0);
    const totalForBill = Math.max(total, 0);

    await supabase
      .from('credit_card_bills')
      .update({
        total_cents: totalForBill,
        minimum_payment_cents: totalForBill > 0 ? Math.max(Math.round(totalForBill * 0.15), 5000) : 0,
      })
      .eq('id', bill.id);
  }

  const { data: card } = await supabase
    .from('accounts')
    .select('credit_limit')
    .eq('id', accountId)
    .single();

  if (card) {
    const { data: openBills } = await supabase
      .from('credit_card_bills')
      .select('total_cents, paid_cents')
      .eq('account_id', accountId)
      .neq('status', 'paid');

    const totalUsed = (openBills || [])
      .reduce((sum: number, b: { total_cents: number; paid_cents: number }) => sum + (b.total_cents - b.paid_cents), 0);

    const creditLimitCents = Math.round((card.credit_limit || 0) * 100);
    const newAvailableBalance = Math.max(0, creditLimitCents - totalUsed) / 100;

    await supabase
      .from('accounts')
      .update({ available_balance: newAvailableBalance })
      .eq('id', accountId);
  }
}

async function processCreditCardBillPayment(
  supabase: any,
  userId: string,
  categoryId: string,
  amountCents: number,
  paymentDate: string
) {
  const { data: creditCard } = await supabase
    .from('accounts')
    .select('id, name, category_id')
    .eq('user_id', userId)
    .eq('type', 'credit_card')
    .eq('category_id', categoryId)
    .single();

  if (!creditCard) return;

  const { data: bills } = await supabase
    .from('credit_card_bills')
    .select('*')
    .eq('account_id', creditCard.id)
    .in('status', ['open', 'closed', 'partial', 'overdue'])
    .order('due_date', { ascending: true });

  if (!bills || bills.length === 0) return;

  let remainingPayment = amountCents;
  for (const bill of bills) {
    if (remainingPayment <= 0) break;
    const billRemaining = bill.total_cents - bill.paid_cents;
    if (billRemaining <= 0) continue;

    const paymentAmount = Math.min(remainingPayment, billRemaining);
    remainingPayment -= paymentAmount;

    const newPaidCents = bill.paid_cents + paymentAmount;
    const newStatus = newPaidCents >= bill.total_cents ? 'paid' : 'partial';

    await supabase
      .from('credit_card_bills')
      .update({
        paid_cents: newPaidCents,
        status: newStatus,
        last_payment_date: paymentDate,
      })
      .eq('id', bill.id);
  }

  await updateCreditCardBillTotals(supabase, creditCard.id);
}

async function runManualTransactionCreate(jobId: string, payload: ManualTransactionPayload) {
  const supabase = getAdminClient();
  const ownerId = payload.owner_id;
  const validated = payload.data;

  let amount = validated.amount_cents / 100;
  if (validated.type === 'expense' && amount > 0) {
    amount = -amount;
  } else if (validated.type === 'income' && amount < 0) {
    amount = Math.abs(amount);
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, type, closing_day, due_day, expiration_date')
    .eq('id', validated.account_id)
    .single();

  if (!account) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Conta não encontrada' });
    return;
  }

  if (account.type === 'credit_card' && isCreditCardExpired(account.expiration_date)) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Este cartão de crédito expirou e não pode ser mais utilizado' });
    return;
  }

  const isCreditCard = account.type === 'credit_card';
  const isCreditCardPurchase = isCreditCard && (validated.type === 'expense' || validated.type === 'income');

  if (isCreditCard && account.closing_day) {
    const transactionDate = new Date(validated.posted_at);
    const closingDay = account.closing_day;
    const dueDay = account.due_day || closingDay + 10;
    const day = transactionDate.getDate();
    const referenceMonth = day > closingDay
      ? new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 1)
      : new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
    const referenceMonthStr = referenceMonth.toISOString().split('T')[0];

    const { data: existingBill } = await supabase
      .from('credit_card_bills')
      .select('id')
      .eq('account_id', validated.account_id)
      .eq('reference_month', referenceMonthStr)
      .single();

    if (!existingBill) {
      const closingDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), closingDay);
      if (closingDate.getDate() !== closingDay) {
        closingDate.setDate(0);
      }
      const dueDateObj = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), dueDay);
      if (dueDateObj.getDate() !== dueDay) {
        dueDateObj.setDate(0);
      }

      await supabase
        .from('credit_card_bills')
        .insert({
          user_id: ownerId,
          account_id: validated.account_id,
          reference_month: referenceMonthStr,
          closing_date: closingDate.toISOString().split('T')[0],
          due_date: dueDateObj.toISOString().split('T')[0],
          status: 'open',
        });
    }
  }

  const installmentTotal = validated.installment_total || 1;
  const isInstallment = installmentTotal > 1;

  if (isInstallment && (validated.type === 'expense' || validated.type === 'income')) {
    const installmentAmount = Math.round(validated.amount_cents / installmentTotal);

    if (isCreditCardPurchase) {
      const billItems: any[] = [];
      let parentId: string | null = null;

      for (let i = 1; i <= installmentTotal; i++) {
        const installmentDate = new Date(validated.posted_at);
        installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
        let installmentBillId: string | null = null;

        if (account.closing_day) {
          const closingDay = account.closing_day;
          const dueDay = account.due_day || closingDay + 10;
          const day = installmentDate.getDate();
          const referenceMonth = day > closingDay
            ? new Date(installmentDate.getFullYear(), installmentDate.getMonth() + 1, 1)
            : new Date(installmentDate.getFullYear(), installmentDate.getMonth(), 1);
          const referenceMonthStr = referenceMonth.toISOString().split('T')[0];

          const { data: bill } = await supabase
            .from('credit_card_bills')
            .select('id')
            .eq('account_id', validated.account_id)
            .eq('reference_month', referenceMonthStr)
            .single();

          if (bill) {
            installmentBillId = bill.id;
          } else {
            const closingDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), closingDay);
            if (closingDate.getDate() !== closingDay) {
              closingDate.setDate(0);
            }
            const dueDateObj = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), dueDay);
            if (dueDateObj.getDate() !== dueDay) {
              dueDateObj.setDate(0);
            }
            const { data: newBill } = await supabase
              .from('credit_card_bills')
              .insert({
                user_id: ownerId,
                account_id: validated.account_id,
                reference_month: referenceMonthStr,
                closing_date: closingDate.toISOString().split('T')[0],
                due_date: dueDateObj.toISOString().split('T')[0],
                status: 'open',
              })
              .select('id')
              .single();

            installmentBillId = newBill?.id || null;
          }
        }

        if (!installmentBillId) {
          await updateJob(jobId, { status: 'failed', error_summary: 'Fatura do cartão não encontrada para a parcela' });
          return;
        }

        const installmentAmountCents = validated.type === 'income'
          ? -Math.abs(installmentAmount)
          : Math.abs(installmentAmount);

        const itemData: Record<string, unknown> = {
          user_id: ownerId,
          account_id: validated.account_id,
          bill_id: installmentBillId,
          category_id: validated.category_id || null,
          posted_at: installmentDate.toISOString().split('T')[0],
          description: `${validated.description} (${i}/${validated.installment_total})`,
          amount_cents: installmentAmountCents,
          currency: validated.currency,
          notes: validated.notes || null,
          source: validated.source || 'manual',
          provider_tx_id: validated.provider_tx_id || null,
          installment_number: i,
          installment_total: validated.installment_total,
          assigned_to: validated.assigned_to || null,
        };

        if (i === 1) {
          const { data: firstItem, error: firstError } = await supabase
            .from('credit_card_bill_items')
            .insert(itemData)
            .select('*')
            .single();

          if (firstError) throw firstError;
          parentId = firstItem.id;
          billItems.push(firstItem);
        } else {
          (itemData as any).installment_parent_id = parentId;
          billItems.push(itemData);
        }
      }

      if (billItems.length > 1) {
        const remainingItems = billItems.slice(1);
        const { error: bulkError } = await supabase
          .from('credit_card_bill_items')
          .insert(remainingItems);

        if (bulkError) throw bulkError;
      }

      await updateCreditCardBillTotals(supabase, validated.account_id);
      projectionCache.invalidateUser(ownerId);

      await updateJob(jobId, {
        status: 'completed',
        progress: { processed: 1, total: 1, result: { is_bill_item: true, installments_created: validated.installment_total } },
      });
      return;
    }

    const transactions: any[] = [];
    let parentId: string | null = null;

    for (let i = 1; i <= installmentTotal; i++) {
      const installmentDate = new Date(validated.posted_at);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

      const installmentAmountReais = validated.type === 'income'
        ? Math.abs(installmentAmount / 100)
        : -Math.abs(installmentAmount / 100);

      const txData: Record<string, unknown> = {
        account_id: validated.account_id,
        category_id: validated.category_id || null,
        posted_at: installmentDate.toISOString().split('T')[0],
        description: `${validated.description} (${i}/${validated.installment_total})`,
        amount: installmentAmountReais,
        currency: validated.currency,
        notes: validated.notes || null,
        user_id: ownerId,
        source: validated.source || 'manual',
        installment_number: i,
        installment_total: validated.installment_total,
        assigned_to: validated.assigned_to || null,
      };

      if (i === 1) {
        const { data: firstTx, error: firstError } = await supabase
          .from('transactions')
          .insert(txData)
          .select('*, accounts(*), categories(*)')
          .single();

        if (firstError) throw firstError;
        parentId = firstTx.id;
        transactions.push(firstTx);
      } else {
        (txData as any).installment_parent_id = parentId;
        transactions.push(txData);
      }
    }

    if (transactions.length > 1) {
      const remainingTxs = transactions.slice(1);
      const { error: bulkError } = await supabase
        .from('transactions')
        .insert(remainingTxs);

      if (bulkError) throw bulkError;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= installmentTotal; i++) {
      const installmentDate = new Date(validated.posted_at);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
      installmentDate.setHours(0, 0, 0, 0);

      if (installmentDate > today && validated.category_id) {
        const year = installmentDate.getFullYear();
        const month = installmentDate.getMonth() + 1;
        const installmentAmountCents = validated.type === 'income'
          ? Math.abs(installmentAmount)
          : -Math.abs(installmentAmount);

        const { data: existingBudget } = await supabase
          .from('budgets')
          .select('id, amount_planned_cents')
          .eq('user_id', ownerId)
          .eq('category_id', validated.category_id)
          .eq('year', year)
          .eq('month', month)
          .single();

        if (existingBudget) {
          await supabase
            .from('budgets')
            .update({
              amount_planned_cents: (existingBudget.amount_planned_cents || 0) + installmentAmountCents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBudget.id);
        } else {
          await supabase
            .from('budgets')
            .insert({
              user_id: ownerId,
              category_id: validated.category_id,
              year,
              month,
              amount_planned_cents: installmentAmountCents,
              amount_actual: 0,
            });
        }
      }
    }

    projectionCache.invalidateUser(ownerId);
    await updateJob(jobId, {
      status: 'completed',
      progress: { processed: 1, total: 1, result: { installments_created: validated.installment_total } },
    });
    return;
  }

  const transactionData: any = {
    account_id: validated.account_id,
    category_id: validated.category_id || null,
    posted_at: validated.posted_at,
    description: validated.description,
    amount: amount,
    currency: validated.currency,
    notes: validated.notes || null,
    user_id: ownerId,
    source: validated.source || 'manual',
    assigned_to: validated.assigned_to || null,
  };

  if (validated.provider_tx_id) {
    transactionData.provider_tx_id = validated.provider_tx_id;
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactionData)
    .select('*, accounts(*), categories(*)')
    .single();

  if (error) {
    await updateJob(jobId, { status: 'failed', error_summary: error.message });
    return;
  }

  if (validated.category_id && validated.type === 'expense') {
    await processCreditCardBillPayment(supabase, ownerId, validated.category_id, Math.abs(validated.amount_cents), validated.posted_at);
  }

  projectionCache.invalidateUser(ownerId);
  await updateJob(jobId, {
    status: 'completed',
    progress: { processed: 1, total: 1, result: { id: data?.id } },
  });
}

async function handleJob(jobId: string) {
  const supabase = getAdminClient();
  const { data: job } = (await (supabase as any)
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()) as { data: any | null };

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'cancelled') {
    return;
  }

  await updateJob(jobId, { status: 'processing' });

  if (job.type === 'csv_import') {
    await runCsvImport(jobId, job.user_id, job.payload as CsvImportPayload);
    return;
  }

  if (job.type === 'ofx_import') {
    await runOfxImport(jobId, job.user_id, job.payload as OfxImportPayload);
    return;
  }

  if (job.type === 'category_migration') {
    await runCategoryMigration(jobId, job.payload as CategoryMigrationPayload);
    return;
  }

  if (job.type === 'openfinance_import') {
    await runOpenFinanceImport(jobId, job.user_id, job.payload as OpenFinancePayload);
    return;
  }

  if (job.type === 'advisor_task') {
    await runAdvisorTask(jobId, job.payload as AdvisorTaskPayload);
    return;
  }

  if (job.type === 'transaction_manual_create') {
    await runManualTransactionCreate(jobId, job.payload as ManualTransactionPayload);
    return;
  }

  await updateJob(jobId, { status: 'failed', error_summary: `Job type não suportado: ${job.type}` });
}

const worker = new Worker(
  jobQueueName,
  async (job: any) => {
    const { jobId } = job.data as { jobId: string };
    await handleJob(jobId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

worker.on('failed', (job: any, err: any) => {
  console.error('Job failed', job?.id, err);
});

console.log('Job worker started');
