/**
 * WhatsApp Transactions Service
 *
 * Handles transaction operations triggered by WhatsApp messages via n8n.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface WhatsAppTransactionInput {
  userId: string;
  description: string;
  amountCents: number; // Positive = income, Negative = expense
  postedAt: string; // YYYY-MM-DD
  categoryName?: string;
  accountName?: string;
  notes?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface UserContext {
  userId: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currentBalance: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    type: 'income' | 'expense';
  }>;
  creditCards: Array<{
    id: string;
    name: string;
    closingDay: number;
    dueDay: number;
    creditLimitCents: number;
    availableLimitCents: number;
    currentBillCents: number;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    postedAt: string;
    categoryName: string | null;
    accountName: string | null;
  }>;
  summary: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
  };
}

export interface InstallmentInput {
  userId: string;
  description: string;
  totalAmountCents: number;
  installmentTotal: number;
  postedAt: string;
  categoryName?: string;
  accountName?: string;
  notes?: string;
}

export interface InstallmentResult {
  success: boolean;
  parentTransactionId?: string;
  installmentsCreated?: number;
  error?: string;
}

export interface QueryParams {
  type?: 'balance' | 'transactions';
  period?: 'today' | 'week' | 'month' | 'custom';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface FormattedBalance {
  totalBalance: number;
  accounts: Array<{ name: string; balance: number }>;
  creditCards: Array<{ name: string; availableLimit: number; currentBill: number }>;
  formattedMessage: string;
}

/**
 * Find or create a category by name
 */
export async function findOrCreateCategory(
  userId: string,
  categoryName: string,
  type: 'income' | 'expense'
): Promise<string | null> {
  const supabase = createAdminClient();

  // Try to find existing category (case insensitive)
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', categoryName)
    .eq('type', type)
    .eq('is_active', true)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new category
  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: categoryName,
      type,
      icon: type === 'income' ? 'bx-wallet' : 'bx-shopping-bag',
      color: type === 'income' ? '#22c55e' : '#ef4444',
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp Transactions] Error creating category:', error);
    return null;
  }

  return created.id;
}

/**
 * Get default account for a user
 */
export async function getDefaultAccount(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Get the first checking account, or any account
  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .order('type', { ascending: true }) // checking comes first alphabetically
    .limit(1)
    .single();

  return data?.id || null;
}

/**
 * Find account by name
 */
export async function findAccountByName(
  userId: string,
  accountName: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', accountName)
    .single();

  return data?.id || null;
}

/**
 * Create a transaction from WhatsApp message
 */
export async function createTransactionFromWhatsApp(
  input: WhatsAppTransactionInput
): Promise<TransactionResult> {
  const supabase = createAdminClient();

  // Determine transaction type based on amount
  const type = input.amountCents >= 0 ? 'income' : 'expense';
  // Convert from centavos to reais (database stores in reais)
  const absoluteAmountReais = Math.abs(input.amountCents) / 100;

  // Find or get account
  let accountId: string | null = null;
  if (input.accountName) {
    accountId = await findAccountByName(input.userId, input.accountName);
  }
  if (!accountId) {
    accountId = await getDefaultAccount(input.userId);
  }

  if (!accountId) {
    return {
      success: false,
      error: 'Nenhuma conta encontrada. Crie uma conta no aplicativo primeiro.',
    };
  }

  // Find or create category
  let categoryId: string | null = null;
  if (input.categoryName) {
    categoryId = await findOrCreateCategory(input.userId, input.categoryName, type);
  }

  // Create transaction (type is inferred from amount sign: negative = expense, positive = income)
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId,
      account_id: accountId,
      category_id: categoryId,
      description: input.description,
      amount: type === 'expense' ? -absoluteAmountReais : absoluteAmountReais,
      posted_at: input.postedAt,
      notes: input.notes ? `${input.notes}\n\n[Via WhatsApp]` : '[Via WhatsApp]',
      source: 'manual',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp Transactions] Error creating transaction:', error);
    console.error('[WhatsApp Transactions] Insert data:', {
      user_id: input.userId,
      account_id: accountId,
      category_id: categoryId,
      description: input.description,
      amount: type === 'expense' ? -absoluteAmountReais : absoluteAmountReais,
      posted_at: input.postedAt,
    });
    return {
      success: false,
      error: `Erro ao criar transação: ${error.message || error.code || 'unknown'}`,
    };
  }

  // Update account balance (in reais)
  const balanceChange = type === 'expense' ? -absoluteAmountReais : absoluteAmountReais;
  await supabase.rpc('update_account_balance', {
    account_id: accountId,
    amount_change: balanceChange,
  });

  return {
    success: true,
    transactionId: transaction.id,
  };
}

/**
 * Get user context for AI agent
 */
export async function getUserContextForAI(userId: string): Promise<UserContext | null> {
  const supabase = createAdminClient();

  // Get accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, current_balance, closing_day, due_day, credit_limit, available_balance')
    .eq('user_id', userId)
    .order('name');

  // Get active categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name');

  // Get recent transactions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      description,
      amount,
      posted_at,
      categories(name),
      accounts(name)
    `)
    .eq('user_id', userId)
    .gte('posted_at', thirtyDaysAgo.toISOString().split('T')[0])
    .order('posted_at', { ascending: false })
    .limit(20);

  // Get credit cards with current bill info
  const creditCardAccounts = (accounts || []).filter((a) => a.type === 'credit_card');
  const currentMonth = new Date();
  const referenceMonthStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  // Get current bills for credit cards
  const creditCardsWithBills = await Promise.all(
    creditCardAccounts.map(async (cc) => {
      const { data: bill } = await supabase
        .from('credit_card_bills')
        .select('total_cents')
        .eq('account_id', cc.id)
        .eq('reference_month', referenceMonthStr)
        .single();

      return {
        id: cc.id,
        name: cc.name,
        closingDay: cc.closing_day || 1,
        dueDay: cc.due_day || 10,
        creditLimitCents: cc.credit_limit || 0,
        availableLimitCents: cc.available_balance || cc.credit_limit || 0,
        currentBillCents: bill?.total_cents || 0,
      };
    })
  );

  // Calculate summary (exclude credit cards from total balance)
  const totalBalance = (accounts || [])
    .filter((a) => a.type !== 'credit_card')
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  const monthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyTransactions = (transactions || []).filter(
    (t) => t.posted_at.startsWith(monthStr)
  );

  const monthlyIncome = monthlyTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    userId,
    accounts: (accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currentBalance: a.current_balance || 0,
    })),
    categories: (categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as 'income' | 'expense',
    })),
    creditCards: creditCardsWithBills,
    recentTransactions: (transactions || []).map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      postedAt: t.posted_at,
      categoryName: (t.categories as any)?.name || null,
      accountName: (t.accounts as any)?.name || null,
    })),
    summary: {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
    },
  };
}

/**
 * Log a WhatsApp message for auditing
 */
export async function logWhatsAppMessage(
  userId: string | null,
  phoneNumber: string,
  direction: 'incoming' | 'outgoing',
  messageType: 'text' | 'audio' | 'image' | 'document' | 'verification',
  options: {
    contentSummary?: string;
    transactionId?: string;
    actionType?: 'create' | 'create_installment' | 'update' | 'delete' | 'query' | 'query_balance' | 'query_transactions' | 'clarify' | 'verification';
    status?: 'pending' | 'processed' | 'failed' | 'ignored';
    errorMessage?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('whatsapp_messages_log').insert({
    user_id: userId,
    phone_number: phoneNumber,
    direction,
    message_type: messageType,
    content_summary: options.contentSummary,
    transaction_id: options.transactionId,
    action_type: options.actionType,
    status: options.status || 'pending',
    error_message: options.errorMessage,
    metadata: options.metadata || {},
    processed_at: options.status === 'processed' ? new Date().toISOString() : null,
  });
}

/**
 * Get or create credit card bill for a transaction date
 */
async function getOrCreateCreditCardBill(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  accountId: string,
  transactionDate: Date,
  closingDay: number,
  dueDay: number
): Promise<string | null> {
  const day = transactionDate.getDate();
  let referenceMonth: Date;

  // Determine which month's bill this transaction belongs to
  if (day > closingDay) {
    // Goes to next month's bill
    referenceMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 1);
  } else {
    // Goes to current month's bill
    referenceMonth = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
  }

  const referenceMonthStr = referenceMonth.toISOString().split('T')[0];

  // Check if bill exists
  const { data: existingBill } = await supabase
    .from('credit_card_bills')
    .select('id')
    .eq('account_id', accountId)
    .eq('reference_month', referenceMonthStr)
    .single();

  if (existingBill) {
    return existingBill.id;
  }

  // Create new bill
  const closingDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), closingDay);
  const dueDateObj = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), dueDay);

  const { data: newBill } = await supabase
    .from('credit_card_bills')
    .insert({
      user_id: userId,
      account_id: accountId,
      reference_month: referenceMonthStr,
      closing_date: closingDate.toISOString().split('T')[0],
      due_date: dueDateObj.toISOString().split('T')[0],
      status: 'open',
      total_cents: 0,
      paid_cents: 0,
    })
    .select('id')
    .single();

  return newBill?.id || null;
}

/**
 * Create installment transactions from WhatsApp
 */
export async function createInstallmentTransactionsFromWhatsApp(
  input: InstallmentInput
): Promise<InstallmentResult> {
  const supabase = createAdminClient();

  // Calculate per-installment amount (convert from cents to reais, database stores in reais)
  const installmentAmountReais = Math.round((input.totalAmountCents / input.installmentTotal)) / 100;

  // Find account (prioritize by name if provided)
  let accountId: string | null = null;
  if (input.accountName) {
    accountId = await findAccountByName(input.userId, input.accountName);
  }
  if (!accountId) {
    accountId = await getDefaultAccount(input.userId);
  }

  if (!accountId) {
    return {
      success: false,
      error: 'Nenhuma conta encontrada. Crie uma conta no aplicativo primeiro.',
    };
  }

  // Check if account is credit card
  const { data: account } = await supabase
    .from('accounts')
    .select('id, type, closing_day, due_day')
    .eq('id', accountId)
    .single();

  const isCreditCard = account?.type === 'credit_card';

  // Find or create category
  const categoryId = input.categoryName
    ? await findOrCreateCategory(input.userId, input.categoryName, 'expense')
    : null;

  let parentId: string | null = null;
  const affectedBillIds = new Set<string>();
  const startDate = new Date(input.postedAt);

  for (let i = 1; i <= input.installmentTotal; i++) {
    // Calculate date for each installment
    const installmentDate = new Date(startDate);
    installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

    // Get credit card bill if applicable
    let creditCardBillId: string | null = null;
    if (isCreditCard && account?.closing_day) {
      creditCardBillId = await getOrCreateCreditCardBill(
        supabase,
        input.userId,
        accountId,
        installmentDate,
        account.closing_day,
        account.due_day || account.closing_day + 10
      );
    }

    let insertResult: { id: string } | null = null;

    if (isCreditCard) {
      if (!creditCardBillId) {
        return { success: false, error: 'Fatura do cartão não encontrada' };
      }

      const itemData: Record<string, any> = {
        user_id: input.userId,
        account_id: accountId,
        bill_id: creditCardBillId,
        category_id: categoryId,
        description: `${input.description} (${i}/${input.installmentTotal})`,
        amount_cents: Math.abs(installmentAmountReais),
        currency: 'BRL',
        posted_at: installmentDate.toISOString().split('T')[0],
        notes: input.notes
          ? `${input.notes}\n\n[Via WhatsApp - Parcelado ${i}/${input.installmentTotal}]`
          : `[Via WhatsApp - Parcelado ${i}/${input.installmentTotal}]`,
        installment_number: i,
        installment_total: input.installmentTotal,
        source: 'manual',
      };

      if (i > 1 && parentId) {
        itemData.installment_parent_id = parentId;
      }

      const { data: item, error } = await supabase
        .from('credit_card_bill_items')
        .insert(itemData)
        .select('id')
        .single();

      if (error) {
        console.error('[WhatsApp] Error creating installment bill item:', error);
        return { success: false, error: 'Erro ao criar parcelas' };
      }

      insertResult = item;
      affectedBillIds.add(creditCardBillId);
    } else {
      const txData: Record<string, any> = {
        user_id: input.userId,
        account_id: accountId,
        category_id: categoryId,
        description: `${input.description} (${i}/${input.installmentTotal})`,
        amount: -installmentAmountReais,
        posted_at: installmentDate.toISOString().split('T')[0],
        notes: input.notes
          ? `${input.notes}\n\n[Via WhatsApp - Parcelado ${i}/${input.installmentTotal}]`
          : `[Via WhatsApp - Parcelado ${i}/${input.installmentTotal}]`,
        installment_number: i,
        installment_total: input.installmentTotal,
        source: 'manual',
      };

      if (i > 1 && parentId) {
        txData.installment_parent_id = parentId;
      }

      const { data: tx, error } = await supabase
        .from('transactions')
        .insert(txData)
        .select('id')
        .single();

      if (error) {
        console.error('[WhatsApp] Error creating installment:', error);
        return { success: false, error: 'Erro ao criar parcelas' };
      }

      insertResult = tx;
    }

    if (i === 1 && insertResult?.id) {
      parentId = insertResult.id;
    }
  }

  if (isCreditCard) {
    for (const billId of affectedBillIds) {
      await supabase.rpc('recalculate_credit_card_bill', {
        p_bill_id: billId,
      });
    }
  } else {
    const balanceChange = -installmentAmountReais;
    await supabase.rpc('update_account_balance', {
      account_id: accountId,
      amount_change: balanceChange,
    });
  }

  return {
    success: true,
    parentTransactionId: parentId!,
    installmentsCreated: input.installmentTotal,
  };
}

/**
 * Get recent transactions with filters
 */
export async function getRecentTransactions(
  userId: string,
  query?: QueryParams
): Promise<any[]> {
  const supabase = createAdminClient();

  let fromDate: string;
  let toDate: string = new Date().toISOString().split('T')[0];
  const limit = query?.limit || 5;

  switch (query?.period) {
    case 'today':
      fromDate = toDate;
      break;
    case 'week':
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      fromDate = weekAgo.toISOString().split('T')[0];
      break;
    case 'custom':
      fromDate = query.fromDate || toDate;
      toDate = query.toDate || toDate;
      break;
    default: // month
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      fromDate = monthAgo.toISOString().split('T')[0];
  }

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, description, amount, posted_at,
      categories(name),
      accounts(name)
    `)
    .eq('user_id', userId)
    .gte('posted_at', fromDate)
    .lte('posted_at', toDate)
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[WhatsApp] Error fetching transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Format balance information for WhatsApp response
 */
export function formatBalanceInfo(context: UserContext): FormattedBalance {
  const accounts = context.accounts
    .filter((a) => a.type !== 'credit_card')
    .map((a) => ({
      name: a.name,
      balance: a.currentBalance / 100,
    }));

  const creditCards = context.creditCards.map((cc) => ({
    name: cc.name,
    availableLimit: cc.availableLimitCents / 100,
    currentBill: cc.currentBillCents / 100,
  }));

  const totalBalance = context.summary.totalBalance / 100;
  const monthlyIncome = context.summary.monthlyIncome / 100;
  const monthlyExpenses = context.summary.monthlyExpenses / 100;

  let message = `*Seu resumo financeiro:*\n\n`;
  message += `*Saldo total:* R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;

  if (accounts.length > 0) {
    message += `*Contas:*\n`;
    accounts.forEach((a) => {
      message += `- ${a.name}: R$ ${a.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    });
    message += `\n`;
  }

  if (creditCards.length > 0) {
    message += `*Cartões de crédito:*\n`;
    creditCards.forEach((cc) => {
      message += `- ${cc.name}: Fatura R$ ${cc.currentBill.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Disponivel R$ ${cc.availableLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    });
    message += `\n`;
  }

  message += `*Este mês:*\n`;
  message += `- Receitas: R$ ${monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  message += `- Despesas: R$ ${monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return {
    totalBalance,
    accounts,
    creditCards,
    formattedMessage: message,
  };
}

/**
 * Format transactions list for WhatsApp
 */
export function formatTransactionsList(transactions: any[]): string {
  if (transactions.length === 0) {
    return 'Nenhuma transação encontrada neste período.';
  }

  let message = `*Últimas ${transactions.length} transações:*\n\n`;

  transactions.forEach((tx, i) => {
    const amount = Math.abs(tx.amount) / 100;
    const type = tx.amount >= 0 ? '+' : '-';
    const date = new Date(tx.posted_at).toLocaleDateString('pt-BR');
    const category = tx.categories?.name || 'Sem categoria';

    message += `${i + 1}. *${tx.description}*\n`;
    message += `   ${date} | ${type}R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${category}\n\n`;
  });

  return message;
}

export interface DeleteTransactionInput {
  userId: string;
  transactionId?: string;
  searchDescription?: string;
  deleteLast?: boolean;
}

export interface DeleteTransactionResult {
  success: boolean;
  deletedTransaction?: {
    id: string;
    description: string;
    amount: number;
    postedAt: string;
  };
  error?: string;
}

/**
 * Delete transaction by ID, description search, or latest
 */
export async function deleteTransaction(
  input: DeleteTransactionInput
): Promise<DeleteTransactionResult> {
  const supabase = createAdminClient();

  let txToDelete: { id: string; description: string; amount: number; account_id: string; posted_at: string } | null = null;

  if (input.transactionId) {
    // Delete by specific ID
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount, account_id, posted_at')
      .eq('id', input.transactionId)
      .eq('user_id', input.userId)
      .single();
    txToDelete = data;
  } else if (input.searchDescription) {
    // Find by description (most recent match)
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount, account_id, posted_at')
      .eq('user_id', input.userId)
      .ilike('description', `%${input.searchDescription}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    txToDelete = data;
  } else if (input.deleteLast) {
    // Get the most recent transaction
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount, account_id, posted_at')
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    txToDelete = data;
  } else {
    return {
      success: false,
      error: 'Informe o ID, descrição ou use delete_last para excluir a última transação',
    };
  }

  if (!txToDelete) {
    return {
      success: false,
      error: 'Transação não encontrada',
    };
  }

  // Delete the transaction
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txToDelete.id);

  if (error) {
    console.error('[WhatsApp] Error deleting transaction:', error);
    return {
      success: false,
      error: 'Erro ao excluir transação',
    };
  }

  // Reverse the balance change
  await supabase.rpc('update_account_balance', {
    account_id: txToDelete.account_id,
    amount_change: -txToDelete.amount,
  });

  return {
    success: true,
    deletedTransaction: {
      id: txToDelete.id,
      description: txToDelete.description,
      amount: txToDelete.amount,
      postedAt: txToDelete.posted_at,
    },
  };
}

/**
 * Get the last transaction created by user
 */
export async function getLastTransaction(userId: string): Promise<any | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, description, amount, posted_at,
      categories(name),
      accounts(name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[WhatsApp] Error fetching last transaction:', error);
    return null;
  }

  return data;
}

export interface UpdateTransactionInput {
  userId: string;
  transactionId?: string;
  searchDescription?: string;
  updateLast?: boolean;
  updates: {
    description?: string;
    amountCents?: number;
    postedAt?: string;
    categoryName?: string;
    accountName?: string;
    notes?: string;
  };
}

export interface UpdateTransactionResult {
  success: boolean;
  updatedTransaction?: {
    id: string;
    description: string;
    amount: number;
    postedAt: string;
  };
  error?: string;
}

/**
 * Update transaction by ID, description search, or latest
 */
export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<UpdateTransactionResult> {
  const supabase = createAdminClient();

  let txToUpdate: { id: string; description: string; amount: number; account_id: string; posted_at: string } | null = null;

  if (input.transactionId) {
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount, account_id, posted_at')
      .eq('id', input.transactionId)
      .eq('user_id', input.userId)
      .single();
    txToUpdate = data;
  } else if (input.searchDescription) {
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount, account_id, posted_at')
      .eq('user_id', input.userId)
      .ilike('description', `%${input.searchDescription}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    txToUpdate = data;
  } else if (input.updateLast) {
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount, account_id, posted_at')
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    txToUpdate = data;
  } else {
    return {
      success: false,
      error: 'Informe o ID, descrição ou use update_last para atualizar a última transação',
    };
  }

  if (!txToUpdate) {
    return {
      success: false,
      error: 'Transação não encontrada',
    };
  }

  // Build update object
  const updateData: Record<string, any> = {};
  const updates = input.updates;

  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }

  if (updates.amountCents !== undefined) {
    // Determine type and convert from cents to reais
    const type = updates.amountCents >= 0 ? 'income' : 'expense';
    const absoluteAmountReais = Math.abs(updates.amountCents) / 100;
    updateData.amount = type === 'expense' ? -absoluteAmountReais : absoluteAmountReais;

    // Calculate balance adjustment (reverse old amount, apply new)
    const balanceChange = updateData.amount - txToUpdate.amount;
    if (balanceChange !== 0) {
      await supabase.rpc('update_account_balance', {
        account_id: txToUpdate.account_id,
        amount_change: balanceChange,
      });
    }
  }

  if (updates.postedAt !== undefined) {
    updateData.posted_at = updates.postedAt;
  }

  if (updates.categoryName !== undefined) {
    // Fix: use explicit undefined check to handle zero amounts correctly
    const existingAmountCents = txToUpdate.amount * 100;
    const amountToCheck = updates.amountCents !== undefined ? updates.amountCents : existingAmountCents;
    const type = amountToCheck >= 0 ? 'income' : 'expense';
    const categoryId = await findOrCreateCategory(input.userId, updates.categoryName, type);
    if (categoryId) {
      updateData.category_id = categoryId;
    }
  }

  if (updates.accountName !== undefined) {
    const accountId = await findAccountByName(input.userId, updates.accountName);
    if (accountId) {
      // If changing accounts, need to adjust balances
      if (accountId !== txToUpdate.account_id) {
        const amount = updateData.amount ?? txToUpdate.amount;
        // Remove from old account
        await supabase.rpc('update_account_balance', {
          account_id: txToUpdate.account_id,
          amount_change: -txToUpdate.amount,
        });
        // Add to new account
        await supabase.rpc('update_account_balance', {
          account_id: accountId,
          amount_change: amount,
        });
      }
      updateData.account_id = accountId;
    }
  }

  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      error: 'Nenhum campo para atualizar',
    };
  }

  // Update transaction
  const { error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', txToUpdate.id);

  if (error) {
    console.error('[WhatsApp] Error updating transaction:', error);
    return {
      success: false,
      error: 'Erro ao atualizar transação',
    };
  }

  return {
    success: true,
    updatedTransaction: {
      id: txToUpdate.id,
      description: updateData.description ?? txToUpdate.description,
      amount: updateData.amount ?? txToUpdate.amount,
      postedAt: updateData.posted_at ?? txToUpdate.posted_at,
    },
  };
}

// ============================================
// NEW QUERY FUNCTIONS
// ============================================

export interface InvestmentResult {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  initialValueCents: number;
  currentValueCents: number;
  monthlyContributionCents: number;
  status: string;
}

export interface InvestmentsQueryResult {
  success: boolean;
  data: InvestmentResult[];
  summary: {
    totalInvestedCents: number;
    totalCurrentValueCents: number;
    totalReturnsCents: number;
    returnPercentage: number;
  };
  message: string;
  error?: string;
}

/**
 * Get user's investments
 */
export async function getInvestments(userId: string): Promise<InvestmentsQueryResult> {
  const supabase = createAdminClient();

  const { data: investments, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('current_value_cents', { ascending: false });

  if (error) {
    console.error('[WhatsApp] Error fetching investments:', error);
    return {
      success: false,
      data: [],
      summary: { totalInvestedCents: 0, totalCurrentValueCents: 0, totalReturnsCents: 0, returnPercentage: 0 },
      message: 'Erro ao buscar investimentos',
      error: error.message,
    };
  }

  const investmentTypes: Record<string, string> = {
    stocks: 'Ações',
    bonds: 'Renda Fixa',
    funds: 'Fundos',
    crypto: 'Crypto',
    real_estate: 'Imóveis',
    other: 'Outros',
  };

  const data: InvestmentResult[] = (investments || []).map((inv) => ({
    id: inv.id,
    name: inv.name,
    type: inv.type,
    institution: inv.institution,
    initialValueCents: inv.initial_investment_cents || 0,
    currentValueCents: inv.current_value_cents || 0,
    monthlyContributionCents: inv.monthly_contribution_cents || 0,
    status: inv.status,
  }));

  const totalInvested = data.reduce((sum, inv) => sum + inv.initialValueCents, 0);
  const totalCurrent = data.reduce((sum, inv) => sum + inv.currentValueCents, 0);
  const totalReturns = totalCurrent - totalInvested;
  const returnPct = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  // Format message
  let message = '📈 *Seus Investimentos*\n\n';

  if (data.length === 0) {
    message = 'Você ainda não tem investimentos cadastrados.';
  } else {
    data.forEach((inv, i) => {
      const typeName = investmentTypes[inv.type] || inv.type;
      const initial = inv.initialValueCents / 100;
      const current = inv.currentValueCents / 100;
      const returnVal = current - initial;
      const returnPctItem = initial > 0 ? (returnVal / initial) * 100 : 0;
      const returnSign = returnVal >= 0 ? '+' : '';

      message += `${i + 1}. *${inv.name}* (${typeName})\n`;
      message += `   Investido: R$ ${initial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      message += `   Valor atual: R$ ${current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${returnSign}${returnPctItem.toFixed(1)}%)\n`;
      if (inv.monthlyContributionCents > 0) {
        message += `   Aporte mensal: R$ ${(inv.monthlyContributionCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
      message += '\n';
    });

    const totalReturnSign = totalReturns >= 0 ? '+' : '';
    message += `💰 *Total investido:* R$ ${(totalInvested / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `💵 *Valor atual:* R$ ${(totalCurrent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `📊 *Rendimento:* ${totalReturnSign}R$ ${(Math.abs(totalReturns) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${totalReturnSign}${returnPct.toFixed(1)}%)`;
  }

  return {
    success: true,
    data,
    summary: {
      totalInvestedCents: totalInvested,
      totalCurrentValueCents: totalCurrent,
      totalReturnsCents: totalReturns,
      returnPercentage: returnPct,
    },
    message,
  };
}

export interface CreditCardResult {
  id: string;
  name: string;
  brand: string | null;
  creditLimitCents: number;
  availableLimitCents: number;
  currentBillCents: number;
  closingDay: number;
  dueDay: number;
  billStatus: string;
}

export interface CreditCardsQueryResult {
  success: boolean;
  data: CreditCardResult[];
  summary: {
    totalLimitCents: number;
    totalAvailableCents: number;
    totalBillsCents: number;
  };
  message: string;
  error?: string;
}

/**
 * Get user's credit cards with current bills
 */
export async function getCreditCardsWithBills(
  userId: string,
  cardName?: string
): Promise<CreditCardsQueryResult> {
  const supabase = createAdminClient();

  // Get credit card accounts
  let query = supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'credit_card');

  if (cardName) {
    query = query.ilike('name', `%${cardName}%`);
  }

  const { data: cards, error } = await query.order('name');

  if (error) {
    console.error('[WhatsApp] Error fetching credit cards:', error);
    return {
      success: false,
      data: [],
      summary: { totalLimitCents: 0, totalAvailableCents: 0, totalBillsCents: 0 },
      message: 'Erro ao buscar cartões',
      error: error.message,
    };
  }

  // Get current month bills
  const currentMonth = new Date();
  const referenceMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const cardIds = (cards || []).map((c) => c.id);
  const { data: bills } = await supabase
    .from('credit_card_bills')
    .select('account_id, total_cents, status')
    .in('account_id', cardIds)
    .eq('reference_month', referenceMonth);

  const billsByCard: Record<string, { total: number; status: string }> = {};
  for (const bill of bills || []) {
    billsByCard[bill.account_id] = { total: bill.total_cents || 0, status: bill.status || 'open' };
  }

  const data: CreditCardResult[] = (cards || []).map((card) => {
    const bill = billsByCard[card.id] || { total: 0, status: 'open' };
    const limit = card.credit_limit || 0;
    const available = limit - bill.total;

    return {
      id: card.id,
      name: card.name,
      brand: card.card_brand || null,
      creditLimitCents: limit,
      availableLimitCents: Math.max(0, available),
      currentBillCents: bill.total,
      closingDay: card.closing_day || 1,
      dueDay: card.due_day || 10,
      billStatus: bill.status,
    };
  });

  const totalLimit = data.reduce((sum, c) => sum + c.creditLimitCents, 0);
  const totalAvailable = data.reduce((sum, c) => sum + c.availableLimitCents, 0);
  const totalBills = data.reduce((sum, c) => sum + c.currentBillCents, 0);

  // Format message
  let message = '💳 *Seus Cartões de Crédito*\n\n';

  if (data.length === 0) {
    message = cardName
      ? `Nenhum cartão encontrado com "${cardName}".`
      : 'Você ainda não tem cartões de crédito cadastrados.';
  } else {
    data.forEach((card, i) => {
      const brandStr = card.brand ? ` (${card.brand})` : '';
      message += `${i + 1}. *${card.name}*${brandStr}\n`;
      message += `   Limite: R$ ${(card.creditLimitCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      message += `   Disponível: R$ ${(card.availableLimitCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      message += `   Fatura atual: R$ ${(card.currentBillCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      message += `   Vencimento: dia ${card.dueDay}\n\n`;
    });

    message += `📊 *Resumo:*\n`;
    message += `Total em faturas: R$ ${(totalBills / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `Limite disponível: R$ ${(totalAvailable / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  return {
    success: true,
    data,
    summary: {
      totalLimitCents: totalLimit,
      totalAvailableCents: totalAvailable,
      totalBillsCents: totalBills,
    },
    message,
  };
}

export interface UpcomingPayment {
  type: 'debt' | 'card_bill' | 'installment' | 'goal_contribution';
  description: string;
  amountCents: number;
  dueDate: string;
  daysUntilDue: number;
  sourceName: string;
}

export interface UpcomingPaymentsResult {
  success: boolean;
  data: UpcomingPayment[];
  summary: {
    next7DaysCents: number;
    next30DaysCents: number;
    overdueCents: number;
  };
  message: string;
  error?: string;
}

/**
 * Get upcoming payments (debts, card bills, goal contributions)
 */
export async function getUpcomingPayments(
  userId: string,
  days: number = 30
): Promise<UpcomingPaymentsResult> {
  const supabase = createAdminClient();
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const payments: UpcomingPayment[] = [];

  // 1. Get debts with due dates
  const { data: debts } = await supabase
    .from('debts')
    .select('id, name, total_amount_cents, paid_amount_cents, due_date, monthly_payment_cents, installment_day')
    .eq('user_id', userId)
    .in('status', ['active', 'negotiating', 'negociando'])
    .not('due_date', 'is', null)
    .gte('due_date', todayStr)
    .lte('due_date', futureDateStr);

  for (const debt of debts || []) {
    const dueDate = new Date(debt.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const remaining = (debt.total_amount_cents || 0) - (debt.paid_amount_cents || 0);
    const amount = debt.monthly_payment_cents || remaining;

    payments.push({
      type: 'debt',
      description: `Dívida: ${debt.name}`,
      amountCents: amount,
      dueDate: debt.due_date,
      daysUntilDue: diffDays,
      sourceName: debt.name,
    });
  }

  // 2. Get credit card bills
  const { data: cards } = await supabase
    .from('accounts')
    .select('id, name, due_day')
    .eq('user_id', userId)
    .eq('type', 'credit_card');

  for (const card of cards || []) {
    // Calculate next due date
    let nextDue = new Date(today.getFullYear(), today.getMonth(), card.due_day || 10);
    if (nextDue <= today) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }

    if (nextDue <= futureDate) {
      // Get current bill
      const refMonth = new Date(nextDue.getFullYear(), nextDue.getMonth(), 1).toISOString().split('T')[0];
      const { data: bill } = await supabase
        .from('credit_card_bills')
        .select('total_cents')
        .eq('account_id', card.id)
        .eq('reference_month', refMonth)
        .single();

      if (bill && bill.total_cents > 0) {
        const diffTime = nextDue.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        payments.push({
          type: 'card_bill',
          description: `Fatura ${card.name}`,
          amountCents: bill.total_cents,
          dueDate: nextDue.toISOString().split('T')[0],
          daysUntilDue: diffDays,
          sourceName: card.name,
        });
      }
    }
  }

  // 3. Get goals with contribution day
  const { data: goals } = await supabase
    .from('goals')
    .select('id, name, monthly_contribution_cents, contribution_day')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('include_in_budget', true)
    .gt('monthly_contribution_cents', 0);

  for (const goal of goals || []) {
    const contribDay = goal.contribution_day || 1;
    let nextContrib = new Date(today.getFullYear(), today.getMonth(), contribDay);
    if (nextContrib <= today) {
      nextContrib.setMonth(nextContrib.getMonth() + 1);
    }

    if (nextContrib <= futureDate) {
      const diffTime = nextContrib.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      payments.push({
        type: 'goal_contribution',
        description: `Aporte: ${goal.name}`,
        amountCents: goal.monthly_contribution_cents,
        dueDate: nextContrib.toISOString().split('T')[0],
        daysUntilDue: diffDays,
        sourceName: goal.name,
      });
    }
  }

  // Sort by due date
  payments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // Calculate summaries
  const next7Days = payments.filter((p) => p.daysUntilDue <= 7 && p.daysUntilDue >= 0);
  const next30Days = payments.filter((p) => p.daysUntilDue <= 30 && p.daysUntilDue >= 0);
  const overdue = payments.filter((p) => p.daysUntilDue < 0);

  const sum7 = next7Days.reduce((sum, p) => sum + p.amountCents, 0);
  const sum30 = next30Days.reduce((sum, p) => sum + p.amountCents, 0);
  const sumOverdue = overdue.reduce((sum, p) => sum + p.amountCents, 0);

  // Format message
  let message = '📅 *Próximos Vencimentos*\n\n';

  if (payments.length === 0) {
    message = `Nenhum vencimento nos próximos ${days} dias. 🎉`;
  } else {
    const thisWeek = payments.filter((p) => p.daysUntilDue <= 7 && p.daysUntilDue >= 0);
    const later = payments.filter((p) => p.daysUntilDue > 7);

    if (thisWeek.length > 0) {
      message += '*Esta semana:*\n';
      for (const p of thisWeek) {
        const emoji = p.daysUntilDue <= 1 ? '🔴' : '🟡';
        const dayText = p.daysUntilDue === 0 ? 'Hoje' : p.daysUntilDue === 1 ? 'Amanhã' : `Em ${p.daysUntilDue} dias`;
        message += `${emoji} ${dayText} - ${p.description}: R$ ${(p.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
      message += '\n';
    }

    if (later.length > 0) {
      message += '*Próximos 30 dias:*\n';
      for (const p of later.slice(0, 5)) {
        const date = new Date(p.dueDate);
        const dateStr = `dia ${date.getDate()}/${date.getMonth() + 1}`;
        message += `• ${p.description} (${dateStr}): R$ ${(p.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      }
      if (later.length > 5) {
        message += `... e mais ${later.length - 5} vencimentos\n`;
      }
      message += '\n';
    }

    message += `💰 *Total 7 dias:* R$ ${(sum7 / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    message += `💰 *Total 30 dias:* R$ ${(sum30 / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  return {
    success: true,
    data: payments,
    summary: {
      next7DaysCents: sum7,
      next30DaysCents: sum30,
      overdueCents: sumOverdue,
    },
    message,
  };
}

export interface BudgetStatusItem {
  categoryId: string;
  categoryName: string;
  plannedCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
  isAutoGenerated: boolean;
}

export interface BudgetStatusResult {
  success: boolean;
  data: BudgetStatusItem[];
  summary: {
    totalPlannedCents: number;
    totalSpentCents: number;
    exceededCount: number;
    warningCount: number;
    okCount: number;
  };
  message: string;
  error?: string;
}

/**
 * Get budget status with alerts
 */
export async function getBudgetStatus(
  userId: string,
  month?: string
): Promise<BudgetStatusResult> {
  const supabase = createAdminClient();

  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const [year, monthNum] = targetMonth.split('-').map(Number);
  const startDate = `${targetMonth}-01`;
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

  // Get budgets
  const { data: budgets, error } = await supabase
    .from('budgets')
    .select(`
      id,
      amount_planned_cents,
      is_auto_generated,
      categories (
        id,
        name,
        type
      )
    `)
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', monthNum);

  if (error) {
    console.error('[WhatsApp] Error fetching budgets:', error);
    return {
      success: false,
      data: [],
      summary: { totalPlannedCents: 0, totalSpentCents: 0, exceededCount: 0, warningCount: 0, okCount: 0 },
      message: 'Erro ao buscar orçamentos',
      error: error.message,
    };
  }

  // Get transactions for the month (expenses only)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('user_id', userId)
    .gte('posted_at', startDate)
    .lte('posted_at', endDate)
    .lt('amount', 0);

  // Sum by category
  const spentByCategory: Record<string, number> = {};
  for (const tx of transactions || []) {
    if (tx.category_id) {
      spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] || 0) + Math.abs(tx.amount * 100);
    }
  }

  const data: BudgetStatusItem[] = (budgets || [])
    .filter((b: any) => b.categories?.name)
    .map((b: any) => {
      const cat = b.categories;
      const planned = b.amount_planned_cents || 0;
      const spent = spentByCategory[cat.id] || 0;
      const remaining = planned - spent;
      const percent = planned > 0 ? (spent / planned) * 100 : 0;

      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (percent > 100) status = 'exceeded';
      else if (percent >= 80) status = 'warning';

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        plannedCents: planned,
        spentCents: spent,
        remainingCents: remaining,
        percentUsed: percent,
        status,
        isAutoGenerated: b.is_auto_generated || false,
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed);

  const exceeded = data.filter((b) => b.status === 'exceeded');
  const warning = data.filter((b) => b.status === 'warning');
  const ok = data.filter((b) => b.status === 'ok');

  const totalPlanned = data.reduce((sum, b) => sum + b.plannedCents, 0);
  const totalSpent = data.reduce((sum, b) => sum + b.spentCents, 0);

  // Format message
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  let message = `📊 *Status dos Orçamentos - ${monthNames[monthNum - 1]}*\n\n`;

  if (data.length === 0) {
    message = 'Você ainda não tem orçamentos cadastrados para este mês.';
  } else {
    if (exceeded.length > 0) {
      message += `🔴 *Estourados (${exceeded.length}):*\n`;
      for (const b of exceeded) {
        message += `• ${b.categoryName}: R$ ${(b.spentCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/R$ ${(b.plannedCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${Math.round(b.percentUsed)}%)\n`;
      }
      message += '\n';
    }

    if (warning.length > 0) {
      message += `🟡 *Atenção (${warning.length}):*\n`;
      for (const b of warning) {
        message += `• ${b.categoryName}: R$ ${(b.spentCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/R$ ${(b.plannedCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${Math.round(b.percentUsed)}%)\n`;
      }
      message += '\n';
    }

    if (ok.length > 0) {
      message += `🟢 *OK (${ok.length}):*\n`;
      for (const b of ok.slice(0, 5)) {
        message += `• ${b.categoryName}: R$ ${(b.spentCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/R$ ${(b.plannedCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${Math.round(b.percentUsed)}%)\n`;
      }
      if (ok.length > 5) {
        message += `... e mais ${ok.length - 5} categorias\n`;
      }
      message += '\n';
    }

    const exceededTotal = exceeded.reduce((sum, b) => sum + (b.spentCents - b.plannedCents), 0);
    if (exceededTotal > 0) {
      message += `💡 *Dica:* Você estourou R$ ${(exceededTotal / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em categorias. Considere ajustar o orçamento ou reduzir gastos.`;
    }
  }

  return {
    success: true,
    data,
    summary: {
      totalPlannedCents: totalPlanned,
      totalSpentCents: totalSpent,
      exceededCount: exceeded.length,
      warningCount: warning.length,
      okCount: ok.length,
    },
    message,
  };
}
