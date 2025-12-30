import { z } from 'zod';

export const accountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['checking', 'savings', 'credit', 'investment']),
  balance_cents: z.number().int().default(0),
  currency: z.string().default('BRL'),
  institution: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['income', 'expense']),
  icon: z.string().default('📁'),
  color: z.string().default('#6b7280'),
});

export const transactionSchema = z.object({
  account_id: z.string().uuid('ID da conta inválido'),
  category_id: z.string().uuid('ID da categoria inválido').optional().or(z.literal('')).transform(val => val || undefined),
  posted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount_cents: z.number().int('Valor deve ser em centavos (número inteiro)'),
  currency: z.string().default('BRL'),
  notes: z.string().optional().or(z.literal('')).transform(val => val || undefined),
  // Extended fields for recurrence and installments
  type: z.enum(['income', 'expense']).optional(),
  source: z.enum(['manual', 'pluggy', 'import']).default('manual'),
  provider_tx_id: z.string().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional().or(z.literal('')).transform(val => val || undefined),
  installment_number: z.number().int().positive().optional(),
  installment_total: z.number().int().positive().optional(),
});

export const budgetSchema = z.object({
  category_id: z.string().uuid('ID da categoria inválido'),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  limit_cents: z.number().int().positive('Limite deve ser positivo'),
});

export const advisorChatSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

// Debts schemas
export const debtSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  creditor_name: z.string().optional(),
  total_amount_cents: z.number().int().positive('Valor total deve ser positivo'),
  paid_amount_cents: z.number().int().min(0).default(0),
  interest_rate: z.number().min(0).max(100).default(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  status: z.enum(['active', 'paid', 'overdue', 'negotiating']).default('active'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  category_id: z.string().uuid('ID da categoria inválido').optional(),
  notes: z.string().optional(),
});

export const debtPaymentSchema = z.object({
  debt_id: z.string().uuid('ID da dívida inválido'),
  amount_cents: z.number().int().positive('Valor deve ser positivo'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  transaction_id: z.string().uuid('ID da transação inválido').optional(),
  notes: z.string().optional(),
});

// Investments schemas
export const investmentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['stocks', 'bonds', 'funds', 'crypto', 'real_estate', 'other']),
  institution: z.string().optional(),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  initial_investment_cents: z.number().int().positive('Investimento inicial deve ser positivo'),
  current_value_cents: z.number().int().min(0).optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  quantity: z.number().positive().optional(),
  unit_price_cents: z.number().int().positive().optional(),
  currency: z.string().default('BRL'),
  status: z.enum(['active', 'sold', 'matured']).default('active'),
  notes: z.string().optional(),
});

export const investmentTransactionSchema = z.object({
  investment_id: z.string().uuid('ID do investimento inválido'),
  type: z.enum(['buy', 'sell', 'dividend', 'interest', 'fee', 'adjustment']),
  amount_cents: z.number().int(),
  quantity: z.number().positive().optional(),
  unit_price_cents: z.number().int().positive().optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  transaction_id: z.string().uuid('ID da transação inválido').optional(),
  notes: z.string().optional(),
});

// Goals schemas
export const goalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  target_amount_cents: z.number().int().positive('Meta deve ser positiva'),
  current_amount_cents: z.number().int().min(0).default(0),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).default('active'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  icon: z.string().default('🎯'),
  color: z.string().default('#6b7280'),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  category_id: z.string().uuid('ID da categoria inválido').optional(),
  notes: z.string().optional(),
});

export const goalContributionSchema = z.object({
  goal_id: z.string().uuid('ID do objetivo inválido'),
  amount_cents: z.number().int().positive('Valor deve ser positivo'),
  contribution_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  transaction_id: z.string().uuid('ID da transação inválido').optional(),
  notes: z.string().optional(),
});

