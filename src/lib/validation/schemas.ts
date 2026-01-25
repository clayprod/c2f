import { z } from 'zod';

export const accountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['checking', 'savings', 'credit', 'investment']),
  balance_cents: z.number().int().default(0),
  currency: z.string().default('BRL'),
  institution: z.string().optional(),
  overdraft_limit_cents: z.number().int().min(0).optional(),
  overdraft_interest_rate_monthly: z.number().min(0).max(100).optional(),
  // Yield configuration
  yield_type: z.enum(['fixed', 'cdi_percentage']).default('fixed'),
  yield_rate_monthly: z.number().min(0).max(100).optional(),
  cdi_percentage: z.number().min(0).max(500).optional(),
}).refine(
  (data) => {
    // If overdraft_limit_cents > 0, overdraft_interest_rate_monthly must be > 0
    if (data.overdraft_limit_cents && data.overdraft_limit_cents > 0) {
      return data.overdraft_interest_rate_monthly !== undefined && data.overdraft_interest_rate_monthly > 0;
    }
    return true;
  },
  {
    message: 'Se o limite de cheque especial for maior que zero, a taxa de juros mensal deve ser informada e maior que zero',
    path: ['overdraft_interest_rate_monthly'],
  }
).refine(
  (data) => {
    // If yield_type is 'fixed' and has yield, yield_rate_monthly must be provided
    if (data.yield_type === 'fixed' && data.yield_rate_monthly !== undefined && data.yield_rate_monthly > 0) {
      return true;
    }
    // If yield_type is 'cdi_percentage', cdi_percentage must be provided
    if (data.yield_type === 'cdi_percentage') {
      return data.cdi_percentage !== undefined && data.cdi_percentage > 0;
    }
    return true;
  },
  {
    message: 'Para rendimento baseado no CDI, informe o percentual do CDI (ex: 100 para 100% do CDI)',
    path: ['cdi_percentage'],
  }
);

export const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['income', 'expense']),
  icon: z.string().default('📁'),
  color: z.string().default('#6b7280'),
  source_type: z.enum(['general', 'credit_card', 'investment', 'goal', 'debt', 'asset']).optional(),
  is_active: z.boolean().optional(),
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
  recurrence_rule: z.string().optional().or(z.literal('')).transform(val => val || undefined),
  include_in_plan: z.boolean().optional(),
  contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  installment_number: z.number().int().positive().optional(),
  installment_total: z.number().int().positive().optional(),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
});

export const budgetSchema = z.object({
  category_id: z.string().uuid('ID da categoria inválido'),
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Data inválida (use YYYY-MM ou YYYY-MM-DD)')
    .transform((val) => {
      // If YYYY-MM format, convert to YYYY-MM-01
      if (val.match(/^\d{4}-\d{2}$/)) {
        return `${val}-01`;
      }
      return val;
    }),
  // When using breakdown_items, limit_cents may be omitted (computed as sum of items)
  limit_cents: z.number()
    .positive('Limite deve ser positivo')
    .transform((val) => Math.round(val)) // Convert to integer
    .optional(),
  breakdown_items: z.array(z.object({
    id: z.string().optional(),
    label: z.string().min(1, 'Nome do sub-item é obrigatório'),
    amount_cents: z.number().int('Valor deve ser em centavos (número inteiro)').positive('Valor deve ser positivo'),
  })).optional(),
  source_type: z.enum(['manual', 'credit_card', 'goal', 'debt', 'receivable', 'installment', 'investment']).optional(),
  source_id: z.string().uuid('ID da origem inválido').optional(),
  is_projected: z.boolean().optional(),
}).refine(
  (data) => {
    const hasBreakdown = Array.isArray(data.breakdown_items) && data.breakdown_items.length > 0;
    const hasLimit = typeof data.limit_cents === 'number' && data.limit_cents > 0;
    return hasBreakdown || hasLimit;
  },
  {
    message: 'Informe um limite (limit_cents) ou detalhe em sub-itens (breakdown_items)',
    path: ['limit_cents'],
  }
);

export const budgetReplicateSchema = z.object({
  budget_id: z.string().uuid('ID do orçamento inválido'),
  months: z.number().int().positive('Número de meses deve ser positivo').optional(),
  end_month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês final inválido (use YYYY-MM)').optional(),
  overwrite: z.boolean().default(false),
}).refine(
  (data) => data.months !== undefined || data.end_month !== undefined,
  {
    message: 'Deve fornecer "months" ou "end_month"',
    path: ['months'],
  }
);

export const budgetQuerySchema = z.object({
  include_projections: z.string().transform((val) => val === 'true').optional(),
  start_month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inicial inválido (use YYYY-MM)').optional(),
  end_month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês final inválido (use YYYY-MM)').optional(),
  projection_years: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0).max(10)).optional(),
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
  // Principal is the original borrowed amount (present value)
  principal_amount_cents: z.number().int().positive('Valor principal deve ser positivo'),
  // Total amount is the full debt with interest (future value)
  total_amount_cents: z.number().int().positive('Valor total deve ser positivo'),
  paid_amount_cents: z.number().int().min(0).default(0),
  // Interest rate is monthly
  interest_rate_monthly: z.number().min(0).max(100).default(0),
  // Interest type: simple or compound
  interest_type: z.enum(['simple', 'compound']).default('simple'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  status: z.enum(['pendente', 'negociada']).default('pendente'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  category_id: z.string().uuid('ID da categoria inválido').optional(),
  notes: z.string().optional(),
  // Option to add principal to cash when debt is created (like receiving a loan)
  adds_to_cash: z.boolean().default(false),
  // Account to receive the principal (if adds_to_cash is true)
  destination_account_id: z.string().uuid('ID da conta de destino inválido').optional(),
  // Installment fields
  installment_amount_cents: z.number().int().positive().optional(),
  installment_count: z.number().int().positive().optional(),
  current_installment: z.number().int().positive().default(1),
  installment_day: z.number().int().min(1).max(31).optional(),
  // Negotiation fields (for status 'negociada')
  payment_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  payment_amount_cents: z.number().int().positive('Valor de pagamento deve ser positivo').optional(),
  // Plan inclusion and frequency
  include_in_plan: z.boolean().default(true),
  contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  contribution_count: z.number().int().positive('Número de pagamentos deve ser positivo').optional(),
  plan_entries: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
    amount_cents: z.number().int().positive('Valor deve ser positivo'),
  })).optional(),
  // Negotiation status
  is_negotiated: z.boolean().optional(),
  // Monthly payment amount for budgeting
  monthly_payment_cents: z.number().int().positive().optional(),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
}).refine(
  (data) => {
    if (data.include_in_plan) {
      return data.contribution_frequency !== undefined || (data.plan_entries && data.plan_entries.length > 0);
    }
    return true;
  },
  {
    message: 'Ao incluir no orçamento, informe frequência de aporte ou plano personalizado',
    path: ['contribution_frequency'],
  }
);

export const debtPaymentSchema = z.object({
  debt_id: z.string().uuid('ID da dívida inválido'),
  amount_cents: z.number().int().positive('Valor deve ser positivo'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  transaction_id: z.string().uuid('ID da transação inválido').optional(),
  notes: z.string().optional(),
});

// Receivables schemas
export const receivableSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  debtor_name: z.string().optional(),
  // Principal is the original amount (present value). Optional; defaults to total_amount_cents when not sent.
  principal_amount_cents: z.number().int().positive('Valor principal deve ser positivo').optional(),
  // Total amount is the full receivable with interest (future value)
  total_amount_cents: z.number().int().positive('Valor total deve ser positivo'),
  received_amount_cents: z.number().int().min(0).default(0),
  // Interest rate is monthly
  interest_rate_monthly: z.number().min(0).max(100).default(0),
  // Interest type: simple or compound
  interest_type: z.enum(['simple', 'compound']).default('simple'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  status: z.enum(['pendente', 'negociada']).default('pendente'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  category_id: z.string().uuid('ID da categoria inválido').optional(),
  notes: z.string().optional(),
  // Option to add principal to cash when receivable is created
  adds_to_cash: z.boolean().default(false),
  // Account to receive the principal (if adds_to_cash is true)
  destination_account_id: z.string().uuid('ID da conta de destino inválido').optional(),
  // Installment fields
  installment_amount_cents: z.number().int().positive().optional(),
  installment_count: z.number().int().positive().optional(),
  current_installment: z.number().int().positive().default(1),
  installment_day: z.number().int().min(1).max(31).optional(),
  // Negotiation fields (for status 'negociada')
  payment_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  payment_amount_cents: z.number().int().positive('Valor de pagamento deve ser positivo').optional(),
  // Plan inclusion and frequency
  include_in_plan: z.boolean().default(true),
  contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  contribution_count: z.number().int().positive('Número de recebimentos deve ser positivo').optional(),
  plan_entries: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
    amount_cents: z.number().int().positive('Valor deve ser positivo'),
  })).optional(),
  // Negotiation status
  is_negotiated: z.boolean().optional(),
  // Monthly payment amount for budgeting
  monthly_payment_cents: z.number().int().positive().optional(),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
}).refine(
  (data) => {
    if (data.status === 'negociada') {
      return data.payment_frequency !== undefined &&
             data.payment_amount_cents !== undefined &&
             data.installment_count !== undefined;
    }
    return true;
  },
  {
    message: 'Para recebíveis negociados, informe frequência, valor e parcelas',
    path: ['payment_frequency'],
  }
).refine(
  (data) => {
    if (data.include_in_plan) {
      return data.contribution_frequency !== undefined || (data.plan_entries && data.plan_entries.length > 0);
    }
    return true;
  },
  {
    message: 'Ao incluir no orçamento, informe frequência de aporte ou plano personalizado',
    path: ['contribution_frequency'],
  }
);

export const receivablePaymentSchema = z.object({
  receivable_id: z.string().uuid('ID do recebível inválido'),
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
  // Monthly contribution fields
  monthly_contribution_cents: z.number().int().positive().optional(),
  contribution_day: z.number().int().min(1).max(31).optional(),
  // Plan inclusion and frequency
  include_in_plan: z.boolean().default(true),
  contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  contribution_count: z.number().int().positive('Número de aportes deve ser positivo').optional(),
  plan_entries: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
    amount_cents: z.number().int().positive('Valor deve ser positivo'),
  })).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional(),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
}).refine(
  (data) => !data.include_in_plan || data.contribution_frequency !== undefined || (data.plan_entries && data.plan_entries.length > 0),
  {
    message: 'Frequência de aporte é obrigatória quando incluir no plano, a menos que use um plano personalizado',
    path: ['contribution_frequency'],
  }
);

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
  image_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url('URL da imagem inválida').optional()
  ),
  image_position: z.union([
    z.enum(['top left', 'top center', 'top right', 'center left', 'center', 'center right', 'bottom left', 'bottom center', 'bottom right']),
    z.string().regex(/^\d+%\s+\d+%$/, 'Formato de posição inválido (use "50% 50%")')
  ]).optional().default('center'),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  category_id: z.string().uuid('ID da categoria inválido').optional(),
  notes: z.string().optional(),
  // Monthly contribution fields
  monthly_contribution_cents: z.number().int().positive().optional(),
  contribution_day: z.number().int().min(1).max(31).optional(),
  // Plan inclusion and frequency
  include_in_plan: z.boolean().default(true),
  contribution_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']).optional(),
  contribution_count: z.number().int().positive('Número de aportes deve ser positivo').optional(),
  plan_entries: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (use YYYY-MM)'),
    amount_cents: z.number().int().positive('Valor deve ser positivo'),
  })).optional(),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
}).refine(
  (data) => !data.include_in_plan || data.contribution_frequency !== undefined || (data.plan_entries && data.plan_entries.length > 0),
  {
    message: 'Frequência de aporte é obrigatória quando incluir no plano, a menos que use um plano personalizado',
    path: ['contribution_frequency'],
  }
);

export const goalContributionSchema = z.object({
  goal_id: z.string().uuid('ID do objetivo inválido'),
  amount_cents: z.number().int().positive('Valor deve ser positivo'),
  contribution_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  transaction_id: z.string().uuid('ID da transação inválido').optional(),
  notes: z.string().optional(),
});

// Reports schemas
export const reportFiltersSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  assignedTo: z.string().uuid().optional().or(z.literal('')).transform(val => val || undefined),
  reportType: z.enum([
    'overview',
    'categories',
    'budgets',
    'goals',
    'debts',
    'investments',
    'cashflow',
  ]).default('overview'),
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('month'),
});

export const exportReportSchema = z.object({
  reportType: z.enum([
    'transactions',
    'categories',
    'budgets',
    'goals',
    'debts',
    'investments',
    'summary',
  ]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida').optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  search: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
  isInstallment: z.boolean().optional(),
  assignedTo: z.string().uuid().optional().or(z.literal('')).transform(val => val || undefined),
  format: z.enum(['csv']).default('csv'),
});

// Credit Card schemas
export const creditCardSchema = z.object({
  name: z.string().min(1, 'Nome do cartão é obrigatório'),
  institution: z.string().nullable().optional(),
  last_four_digits: z.union([
    z.string().regex(/^\d{4}$/, 'Ultimos 4 digitos invalidos'),
    z.literal(''),
    z.null(),
  ]).optional().transform((val) => val && val.trim() !== '' ? val.trim() : null),
  card_brand: z.enum(['visa', 'mastercard', 'amex', 'elo', 'hipercard', 'diners', 'other']).nullable().optional(),
  credit_limit_cents: z.number().int().min(0, 'Limite deve ser positivo').default(0),
  closing_day: z.number().int().min(1).max(31, 'Dia de fechamento deve ser entre 1 e 31'),
  due_day: z.number().int().min(1).max(31, 'Dia de vencimento deve ser entre 1 e 31'),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento invalida (use YYYY-MM-DD)').optional().or(z.literal('')),
  // Note: interest_rate fields are kept for frontend compatibility but not saved to DB
  // These fields are optional and will be ignored during database insertion
  interest_rate_monthly: z.number().min(0).optional().or(z.null()).transform(() => undefined),
  interest_rate_annual: z.number().min(0).optional().or(z.null()).transform(() => undefined),
  color: z.string().default('#1a1a2e'),
  is_default: z.boolean().default(false),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
});

export const creditCardUpdateSchema = creditCardSchema.partial();

export const creditCardBillSchema = z.object({
  account_id: z.string().uuid('ID do cartão inválido'),
  reference_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Mes de referencia invalido'),
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de fechamento invalida'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vencimento invalida'),
  total_cents: z.number().int().min(0).default(0),
  minimum_payment_cents: z.number().int().min(0).default(0),
  paid_cents: z.number().int().min(0).default(0),
  status: z.enum(['open', 'closed', 'paid', 'partial', 'overdue']).default('open'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de pagamento invalida').optional(),
});

export const creditCardBillPaymentSchema = z.object({
  amount_cents: z.number().int().positive('Valor deve ser positivo'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de pagamento invalida'),
  from_account_id: z.string().uuid('ID da conta de origem invalido').optional(),
});

// Assets schemas
export const assetSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['real_estate', 'vehicle', 'rights', 'equipment', 'jewelry', 'other']),
  description: z.string().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  purchase_price_cents: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') {
        return val; // Let Zod handle the error
      }
      if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) return val;
        return Math.round(val * 100);
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return val;
        const parsed = parseFloat(trimmed);
        if (isNaN(parsed) || !isFinite(parsed)) return val;
        return Math.round(parsed * 100);
      }
      return val;
    },
    z.number().int().positive('Valor de compra deve ser positivo')
  ),
  current_value_cents: z.preprocess(
    (val) => {
      // Handle empty values
      if (val === '' || val === null || val === undefined) {
        return undefined;
      }
      // Handle number values (already in reais, convert to cents)
      if (typeof val === 'number') {
        return Math.round(val * 100);
      }
      // Handle string values
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return undefined;
        const parsed = parseFloat(trimmed);
        return isNaN(parsed) ? undefined : Math.round(parsed * 100);
      }
      return undefined;
    },
    z.number().int().min(0).optional()
  ),
  location: z.string().optional(),
  license_plate: z.string().optional(),
  registration_number: z.string().optional(),
  insurance_company: z.string().optional(),
  insurance_policy_number: z.string().optional(),
  insurance_expiry_date: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) {
        return undefined;
      }
      return val;
    },
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional()
  ),
  status: z.enum(['active', 'sold', 'disposed']).default('active'),
  sale_date: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) {
        return undefined;
      }
      return val;
    },
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)').optional()
  ),
  sale_price_cents: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') {
        return undefined;
      }
      if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) return undefined;
        return Math.round(val * 100);
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return undefined;
        const parsed = parseFloat(trimmed);
        return isNaN(parsed) ? undefined : Math.round(parsed * 100);
      }
      return undefined;
    },
    z.number().int().min(0).optional()
  ),
  depreciation_method: z.enum(['linear', 'declining_balance', 'none']).default('none'),
  depreciation_rate: z.number().min(0).max(100).optional(),
  useful_life_years: z.number().int().positive().optional(),
  account_id: z.string().uuid('ID da conta inválido').optional(),
  category_id: z.string().uuid('ID da categoria inválido').optional(),
  notes: z.string().optional(),
  // Assigned to (for shared accounts)
  assigned_to: z.union([
    z.string().uuid('ID do responsável inválido'),
    z.literal(''),
    z.null()
  ]).optional().transform(val => val === '' || val === null ? undefined : val),
}).refine(
  (data) => data.status !== 'sold' || (data.sale_date && data.sale_price_cents !== undefined),
  { message: 'Data e valor de venda são obrigatórios para bens vendidos', path: ['sale_date'] }
);

export const assetValuationSchema = z.object({
  asset_id: z.string().uuid('ID do bem inválido'),
  valuation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)'),
  value_cents: z.number().int().positive('Valor deve ser positivo'),
  valuation_type: z.enum(['manual', 'depreciation', 'market']).default('manual'),
  notes: z.string().optional(),
});

// Blog schemas
export const blogPostSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio').max(200, 'Titulo muito longo'),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifens')
    .max(200)
    .optional()
    .or(z.literal('')),
  excerpt: z.string().min(1, 'Resumo e obrigatorio').max(500, 'Resumo muito longo'),
  content: z.string().min(1, 'Conteudo e obrigatorio'),
  cover_image: z.string().url('URL da imagem invalida').optional().or(z.literal('')),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  category: z.string().max(100).optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  meta_title: z.string().max(70, 'Meta title muito longo (max 70 chars)').optional().or(z.literal('')),
  meta_description: z.string().max(160, 'Meta description muito longa (max 160 chars)').optional().or(z.literal('')),
});

export const blogPostUpdateSchema = blogPostSchema.partial();
