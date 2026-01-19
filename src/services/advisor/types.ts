/**
 * Types for AI Advisor Service
 */

// Response structure from LLM
export interface AdvisorResponse {
  summary: string;
  insights: AdvisorInsight[];
  actions: AdvisorAction[];
  confidence: 'low' | 'medium' | 'high';
  citations: AdvisorCitation[];
}

export interface AdvisorInsight {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AdvisorAction {
  type: string;
  description?: string;
  payload: Record<string, any>;
  confidence: 'low' | 'medium' | 'high';
}

export interface AdvisorCitation {
  type: 'transaction' | 'account' | 'budget' | 'category' | 'goal' | 'debt' | 'receivable' | 'investment';
  id: string;
  reference: string;
}

// Chat message structure
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// Chat session stored in Redis
export interface ChatSession {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  contextHash: string;
  tokenCount: number;
}

// Financial context for LLM
export interface FinancialContext {
  user: {
    id: string;
    name: string | null;
    plan: string;
    created_at: string;
    // Extended profile fields
    monthly_income_declared: number | null;
    location: {
      city: string | null;
      state: string | null;
    };
    age: number | null;
  };
  snapshot: {
    net_worth: number;
    total_assets: number;
    total_liabilities: number;
    total_receivables: number;
    // Current month values
    monthly_income: number;
    monthly_expenses: number;
    // Average from last 6 months (more representative)
    avg_monthly_income: number;
    avg_monthly_expenses: number;
    // User declared income
    monthly_income_declared: number | null;
    savings_rate: number;
    // Difference between declared and calculated income (positive = earning more than declared)
    income_variance: number | null;
  };
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    credit_limit?: number;
    utilization?: number;
  }>;
  categories_summary: Array<{
    id: string;
    name: string;
    type: 'income' | 'expense';
    total_6_months: number;
    avg_monthly: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  monthly_history: Array<{
    year_month: string;
    income: number;
    expenses: number;
    balance: number;
  }>;
  budgets: Array<{
    id: string;
    category: string;
    year: number;
    month: number;
    planned: number;
    actual: number;
    variance: number;
    is_over: boolean;
  }>;
  goals: Array<{
    id: string;
    name: string;
    target: number;
    current: number;
    progress_pct: number;
    target_date: string | null;
    on_track: boolean;
    status: string;
    // True if this is the default emergency fund goal (6x monthly income)
    is_emergency_fund: boolean;
  }>;
  debts: Array<{
    id: string;
    name: string;
    remaining: number;
    interest_rate: number;
    due_date: string | null;
    status: string;
    priority: string;
  }>;
  receivables: Array<{
    id: string;
    name: string;
    remaining: number;
    interest_rate: number;
    due_date: string | null;
    status: string;
    priority: string;
  }>;
  investments: Array<{
    id: string;
    name: string;
    type: string;
    current_value: number;
    initial_value: number;
    roi: number;
  }>;
  assets: Array<{
    id: string;
    name: string;
    type: string;
    current_value: number;
  }>;
  credit_cards: Array<{
    id: string;
    name: string;
    limit: number;
    available: number;
    utilization_pct: number;
    next_due: string | null;
  }>;
  alerts: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// LLM call params
export interface LLMCallParams {
  messages: ChatMessage[];
  systemPrompt: string;
  userId: string;
  responseFormat?: 'json' | 'text';
  maxTokens?: number;
}

// LLM response
export interface LLMResponse {
  content: string;
  parsed?: AdvisorResponse;
  tokensUsed?: number;
}
