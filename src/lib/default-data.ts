// Default categories and account data for new users

export const DEFAULT_CATEGORIES = [
  // Expenses
  { name: 'ALIMENTACAO', icon: '🍽️', color: '#FF6B6B', type: 'expense' as const },
  { name: 'TRANSPORTE', icon: '🚗', color: '#4ECDC4', type: 'expense' as const },
  { name: 'MORADIA', icon: '🏠', color: '#45B7D1', type: 'expense' as const },
  { name: 'SAUDE', icon: '🏥', color: '#96CEB4', type: 'expense' as const },
  { name: 'EDUCACAO', icon: '📚', color: '#FFEAA7', type: 'expense' as const },
  { name: 'LAZER', icon: '🎮', color: '#DDA0DD', type: 'expense' as const },
  { name: 'VESTUARIO', icon: '👕', color: '#F8BBD9', type: 'expense' as const },
  { name: 'SERVICOS', icon: '🔧', color: '#FFB347', type: 'expense' as const },
  { name: 'IMPOSTOS', icon: '💰', color: '#FF6347', type: 'expense' as const },
  { name: 'SUPERMERCADO', icon: '🛒', color: '#FF8C00', type: 'expense' as const },
  { name: 'AGUA', icon: '💧', color: '#00BFFF', type: 'expense' as const },
  { name: 'ENERGIA', icon: '⚡', color: '#FFD700', type: 'expense' as const },
  { name: 'GAS', icon: '🔥', color: '#FF4500', type: 'expense' as const },
  { name: 'INTERNET', icon: '🌐', color: '#9370DB', type: 'expense' as const },
  { name: 'CELULAR', icon: '📱', color: '#20B2AA', type: 'expense' as const },
  { name: 'ASSINATURAS', icon: '📺', color: '#FF69B4', type: 'expense' as const },
  { name: 'BELEZA', icon: '💄', color: '#FF1493', type: 'expense' as const },
  { name: 'VIAGENS', icon: '✈️', color: '#4169E1', type: 'expense' as const },
  { name: 'SEGUROS', icon: '🛡️', color: '#32CD32', type: 'expense' as const },
  { name: 'JUROS', icon: '📊', color: '#DC143C', type: 'expense' as const },
  { name: 'OUTROS', icon: '📌', color: '#808080', type: 'expense' as const },
  // Income
  { name: 'SALARIO', icon: '💼', color: '#20B2AA', type: 'income' as const },
  { name: 'FREELANCE', icon: '💻', color: '#9370DB', type: 'income' as const },
  { name: 'INVESTIMENTOS', icon: '📊', color: '#00CED1', type: 'income' as const },
  { name: 'REEMBOLSOS', icon: '💸', color: '#32CD32', type: 'income' as const },
];

export const DEFAULT_ACCOUNT = {
  name: 'Conta Principal',
  type: 'checking' as const,
  currency: 'BRL',
  institution: '',
  balance_cents: 0,
  is_default: true,
  color: '#3B82F6',
  icon: '🏦',
};

export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface DefaultAccount {
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'credit_card' | 'investment';
  currency: string;
  institution: string;
  balance_cents: number;
  is_default: boolean;
  color: string;
  icon: string;
}
