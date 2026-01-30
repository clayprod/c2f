import { Worker } from 'bullmq';
import { getRedisConnection } from '../lib/queue/redis';
import { importQueueName } from '../lib/queue/importQueue';
import { getAdminClient } from '../lib/supabase/admin';
import { parseCSV, ParsedCSVTransaction } from '../services/import/csvParser';
import { projectionCache } from '../services/projections/cache';

interface ImportJobOptions {
  account_id?: string | null;
  categories?: Record<string, string>;
  categories_to_create?: Array<{ name: string; type: 'income' | 'expense' }>;
  selected_ids?: string[];
}

const BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE) || 200;
const CHECK_BATCH_SIZE = 500;

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

  const supabase = getAdminClient();
  const insertData = categories.map(cat => ({
    user_id: userId,
    name: cat.name,
    type: cat.type,
    icon: cat.type === 'income' ? '💰' : '💸',
    color: cat.type === 'income' ? '#22c55e' : '#ef4444',
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

async function updateJob(jobId: string, update: Record<string, any>) {
  const supabase = getAdminClient();
  await (supabase as any)
    .from('import_jobs')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

async function processImportJob(jobId: string) {
  const supabase = getAdminClient();

  const { data: job } = (await (supabase as any)
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .single()) as { data: any | null };

  if (!job) {
    throw new Error('Import job not found');
  }

  if (job.status === 'cancelled') {
    return;
  }

  await updateJob(jobId, { status: 'processing' });

  const { data: fileData, error: fileError } = await supabase.storage
    .from(job.storage_bucket)
    .download(job.storage_path);

  if (fileError || !fileData) {
    await updateJob(jobId, {
      status: 'failed',
      error_summary: fileError?.message || 'Arquivo não encontrado',
    });
    return;
  }

  const csvContent = await fileData.text();
  const allTransactions = parseCSV(csvContent);
  const options = (job.options || {}) as ImportJobOptions;
  const selectedIds = options.selected_ids || [];
  const categoryMappings = options.categories || {};
  const categoriesToCreate = options.categories_to_create || [];

  let transactionsToImport = allTransactions;
  if (selectedIds.length > 0) {
    const selectedSet = new Set(selectedIds);
    transactionsToImport = allTransactions.filter(tx => selectedSet.has(tx.id));
  }

  const totalRows = transactionsToImport.length;
  await updateJob(jobId, { total_rows: totalRows, processed_rows: 0 });

  if (totalRows === 0) {
    await updateJob(jobId, { status: 'completed', error_summary: 'Nenhuma transação selecionada' });
    return;
  }

  const defaultAccountId = await getDefaultAccountId(job.user_id, options.account_id);
  if (!defaultAccountId) {
    await updateJob(jobId, { status: 'failed', error_summary: 'Conta padrão não encontrada' });
    return;
  }

  let createdCategoryMap = new Map<string, string>();
  if (categoriesToCreate.length > 0) {
    createdCategoryMap = await createCategories(job.user_id, categoriesToCreate);
  }

  const mappedTransactions = applyCategoryMappings(transactionsToImport, categoryMappings, createdCategoryMap);
  const fallbackCategoryId = await getFallbackCategoryId(job.user_id);

  const existingIdsSet = new Set<string>();
  const providerTxIds = mappedTransactions.map(tx => tx.id);

  for (let i = 0; i < providerTxIds.length; i += CHECK_BATCH_SIZE) {
    const batch = providerTxIds.slice(i, i + CHECK_BATCH_SIZE);
    const { data: existingByIds } = (await (supabase as any)
      .from('transactions')
      .select('provider_tx_id')
      .eq('user_id', job.user_id)
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
      .eq('user_id', job.user_id)
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
      user_id: job.user_id,
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
  const totalBatches = Math.ceil(totalToInsert / BATCH_SIZE) || 1;

  for (let i = 0; i < totalToInsert; i += BATCH_SIZE) {
    const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const { error: insertError } = await (supabase as any)
      .from('transactions')
      .insert(batch);

    if (insertError) {
      errors.push(`Erro ao inserir lote ${batchNumber}: ${insertError.message}`);
    } else {
      imported += batch.length;
    }

    const processed = Math.min(i + batch.length, totalToInsert);
    await updateJob(jobId, {
      processed_rows: processed,
      imported,
      skipped,
      error_count: errors.length,
      error_summary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    });

    if (batchNumber < totalBatches) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const status = errors.length > 0 && imported === 0 ? 'failed' : 'completed';
  await updateJob(jobId, {
    status,
    processed_rows: totalToInsert,
    imported,
    skipped,
    error_count: errors.length,
    error_summary: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
  });

  projectionCache.invalidateUser(job.user_id);

  if (String(process.env.IMPORT_DELETE_AFTER || 'true').toLowerCase() !== 'false') {
    await supabase.storage.from(job.storage_bucket).remove([job.storage_path]);
  }
}

const worker = new Worker(
  importQueueName,
  async (job: any) => {
    const { jobId } = job.data as { jobId: string };
    await processImportJob(jobId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

worker.on('failed', (job: any, err: any) => {
  console.error('CSV import job failed', job?.id, err);
});

console.log('CSV import worker started');
