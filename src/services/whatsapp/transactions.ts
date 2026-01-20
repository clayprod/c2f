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
      icon: type === 'income' ? 'bx-wallet' : 'bx-cart',
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
  const absoluteAmount = Math.abs(input.amountCents);

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

  // Create transaction
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId,
      account_id: accountId,
      category_id: categoryId,
      description: input.description,
      amount: type === 'expense' ? -absoluteAmount : absoluteAmount,
      type,
      posted_at: input.postedAt,
      notes: input.notes ? `${input.notes}\n\n[Via WhatsApp]` : '[Via WhatsApp]',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[WhatsApp Transactions] Error creating transaction:', error);
    return {
      success: false,
      error: 'Erro ao criar transacao',
    };
  }

  // Update account balance
  const balanceChange = type === 'expense' ? -absoluteAmount : absoluteAmount;
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

  // Calculate per-installment amount (in cents)
  const installmentAmountCents = Math.round(input.totalAmountCents / input.installmentTotal);

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

    const txData: Record<string, any> = {
      user_id: input.userId,
      account_id: accountId,
      category_id: categoryId,
      description: `${input.description} (${i}/${input.installmentTotal})`,
      amount: -installmentAmountCents, // Negative for expense (stored in cents in DB? Let me check)
      type: 'expense',
      posted_at: installmentDate.toISOString().split('T')[0],
      notes: input.notes
        ? `${input.notes}\n\n[Via WhatsApp - Parcelado ${i}/${input.installmentTotal}]`
        : `[Via WhatsApp - Parcelado ${i}/${input.installmentTotal}]`,
      installment_number: i,
      installment_total: input.installmentTotal,
      source: 'manual',
    };

    if (creditCardBillId) {
      txData.credit_card_bill_id = creditCardBillId;
    }

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

    if (i === 1) {
      parentId = tx.id;
    }
  }

  // Update account balance for first installment only (others are future)
  const balanceChange = -installmentAmountCents;
  await supabase.rpc('update_account_balance', {
    account_id: accountId,
    amount_change: balanceChange,
  });

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

  const { data } = await supabase
    .from('transactions')
    .select(`
      id, description, amount, posted_at, type,
      categories(name),
      accounts(name)
    `)
    .eq('user_id', userId)
    .gte('posted_at', fromDate)
    .lte('posted_at', toDate)
    .order('posted_at', { ascending: false })
    .limit(limit);

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
    message += `*Cartoes de credito:*\n`;
    creditCards.forEach((cc) => {
      message += `- ${cc.name}: Fatura R$ ${cc.currentBill.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Disponivel R$ ${cc.availableLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    });
    message += `\n`;
  }

  message += `*Este mes:*\n`;
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
    return 'Nenhuma transacao encontrada neste periodo.';
  }

  let message = `*Ultimas ${transactions.length} transacoes:*\n\n`;

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
      error: 'Informe o ID, descricao ou use delete_last para excluir a ultima transacao',
    };
  }

  if (!txToDelete) {
    return {
      success: false,
      error: 'Transacao nao encontrada',
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
      error: 'Erro ao excluir transacao',
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

  const { data } = await supabase
    .from('transactions')
    .select(`
      id, description, amount, posted_at, type,
      categories(name),
      accounts(name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}
