/**
 * WhatsApp Transactions Service
 *
 * Handles transaction operations triggered by WhatsApp messages via n8n.
 */

import { createClient } from '@/lib/supabase/server';

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

/**
 * Find or create a category by name
 */
export async function findOrCreateCategory(
  userId: string,
  categoryName: string,
  type: 'income' | 'expense'
): Promise<string | null> {
  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

  // Get accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, current_balance')
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

  // Calculate summary
  const totalBalance = (accounts || []).reduce(
    (sum, acc) => sum + (acc.current_balance || 0),
    0
  );

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyTransactions = (transactions || []).filter(
    (t) => t.posted_at.startsWith(currentMonth)
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
    actionType?: 'create' | 'update' | 'delete' | 'query' | 'clarify' | 'verification';
    status?: 'pending' | 'processed' | 'failed' | 'ignored';
    errorMessage?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  const supabase = await createClient();

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
