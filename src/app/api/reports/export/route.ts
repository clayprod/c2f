import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { exportReportSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { ZodError } from 'zod';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

interface Transaction {
  id: string;
  posted_at: string;
  description: string;
  amount: number; // NUMERIC from DB
  currency: string;
  notes: string | null;
  accounts?: { name: string } | null;
  categories?: { name: string; type: string } | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
}

interface Budget {
  id: string;
  month: string;
  limit_cents: number;
  categories?: { name: string } | null;
}

interface Goal {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  target_date: string | null;
  start_date: string | null;
  status: string;
  priority: string;
}

interface Debt {
  id: string;
  name: string;
  creditor_name: string | null;
  total_amount_cents: number;
  paid_amount_cents: number;
  interest_rate: number;
  due_date: string | null;
  status: string;
  priority: string;
}

interface Investment {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  initial_investment_cents: number;
  current_value_cents: number | null;
  purchase_date: string;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const params = exportReportSchema.parse(body);
    const supabase = await createClient();

    let csvContent = '';
    let filename = '';

    switch (params.reportType) {
      case 'transactions':
        ({ csvContent, filename } = await exportTransactions(supabase, ownerId, params));
        break;
      case 'categories':
        ({ csvContent, filename } = await exportCategories(supabase, ownerId, params));
        break;
      case 'budgets':
        ({ csvContent, filename } = await exportBudgets(supabase, ownerId, params));
        break;
      case 'goals':
        ({ csvContent, filename } = await exportGoals(supabase, ownerId));
        break;
      case 'debts':
        ({ csvContent, filename } = await exportDebts(supabase, ownerId));
        break;
      case 'investments':
        ({ csvContent, filename } = await exportInvestments(supabase, ownerId));
        break;
      case 'summary':
        ({ csvContent, filename } = await exportSummary(supabase, ownerId, params));
        break;
      default:
        return NextResponse.json({ error: 'Tipo de relatório inválido' }, { status: 400 });
    }

    // Add BOM for UTF-8 Excel compatibility
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos', details: error.errors },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

type ExportParams = {
  startDate: string;
  endDate: string;
  accountIds?: string[];
  categoryIds?: string[];
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function formatCurrency(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(headers: string[], rows: (string | number | null)[][]): string {
  const headerLine = headers.map(escapeCSV).join(';');
  const dataLines = rows.map((row) => row.map(escapeCSV).join(';'));
  return [headerLine, ...dataLines].join('\n');
}

async function exportTransactions(
  supabase: SupabaseClient,
  userId: string,
  params: ExportParams
): Promise<{ csvContent: string; filename: string }> {
  let query = supabase
    .from('transactions')
    .select('id, posted_at, description, amount, currency, notes, accounts(name), categories(name, type)')
    .eq('user_id', userId)
    .gte('posted_at', params.startDate)
    .lte('posted_at', params.endDate)
    .order('posted_at', { ascending: false });

  if (params.accountIds?.length) {
    query = query.in('account_id', params.accountIds);
  }
  if (params.categoryIds?.length) {
    query = query.in('category_id', params.categoryIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const transactions = data as unknown as Transaction[];

  const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Conta', 'Valor (R$)', 'Moeda', 'Notas'];
  const rows = transactions.map((tx) => [
    formatDate(tx.posted_at),
    tx.description,
    tx.categories?.name || 'Sem Categoria',
    tx.categories?.type === 'income' ? 'Receita' : 'Despesa',
    tx.accounts?.name || '',
    formatCurrency(Math.round((tx.amount || 0) * 100)),
    tx.currency,
    tx.notes || '',
  ]);

  const filename = `transacoes_${params.startDate}_${params.endDate}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}

async function exportCategories(
  supabase: SupabaseClient,
  userId: string,
  params: ExportParams
): Promise<{ csvContent: string; filename: string }> {
  const [categoriesResult, transactionsResult] = await Promise.all([
    supabase.from('categories').select('id, name, type, icon').eq('user_id', userId),
    supabase
      .from('transactions')
      .select('amount, category_id, categories(type)')
      .eq('user_id', userId)
      .gte('posted_at', params.startDate)
      .lte('posted_at', params.endDate),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const categories = categoriesResult.data as Category[];

  interface TxForCategory {
    amount: number; // NUMERIC from DB
    category_id: string | null;
    categories?: { type: string } | null;
  }

  const transactions = transactionsResult.data as unknown as TxForCategory[];

  const totals = new Map<string, { income: number; expense: number; count: number }>();

  for (const tx of transactions) {
    const catId = tx.category_id || 'sem-categoria';
    if (!totals.has(catId)) {
      totals.set(catId, { income: 0, expense: 0, count: 0 });
    }
    const cat = totals.get(catId)!;
    // Convert NUMERIC to cents
    const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
    const isIncome = tx.categories?.type === 'income' || tx.amount > 0;
    if (isIncome) {
      cat.income += amountCents;
    } else {
      cat.expense += amountCents;
    }
    cat.count += 1;
  }

  const headers = ['Categoria', 'Tipo', 'Total Receitas (R$)', 'Total Despesas (R$)', 'Saldo (R$)', 'Qtd Transações'];
  const rows: (string | number | null)[][] = [];

  for (const cat of categories) {
    const t = totals.get(cat.id) || { income: 0, expense: 0, count: 0 };
    rows.push([
      cat.name,
      cat.type === 'income' ? 'Receita' : 'Despesa',
      formatCurrency(t.income),
      formatCurrency(t.expense),
      formatCurrency(t.income - t.expense),
      t.count,
    ]);
  }

  // Add "Sem Categoria"
  const semCategoria = totals.get('sem-categoria');
  if (semCategoria) {
    rows.push([
      'Sem Categoria',
      '-',
      formatCurrency(semCategoria.income),
      formatCurrency(semCategoria.expense),
      formatCurrency(semCategoria.income - semCategoria.expense),
      semCategoria.count,
    ]);
  }

  const filename = `categorias_${params.startDate}_${params.endDate}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}

async function exportBudgets(
  supabase: SupabaseClient,
  userId: string,
  params: ExportParams
): Promise<{ csvContent: string; filename: string }> {
  const startMonth = params.startDate.substring(0, 7) + '-01';
  const endMonth = params.endDate.substring(0, 7) + '-01';

  const [budgetsResult, transactionsResult] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, month, amount_planned_cents, category_id, categories(name)')
      .eq('user_id', userId)
      .gte('month', startMonth)
      .lte('month', endMonth),
    supabase
      .from('transactions')
      .select('amount, posted_at, category_id, categories(type)')
      .eq('user_id', userId)
      .gte('posted_at', params.startDate)
      .lte('posted_at', params.endDate),
  ]);

  if (budgetsResult.error) throw budgetsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  interface BudgetWithCategory {
    id: string;
    month: string;
    amount_planned_cents: number;
    category_id: string;
    categories?: { name: string } | null;
  }

  interface TxForBudget {
    amount: number; // NUMERIC from DB
    posted_at: string;
    category_id: string | null;
    categories?: { type: string } | null;
  }

  const budgets = budgetsResult.data as unknown as BudgetWithCategory[];
  const transactions = transactionsResult.data as unknown as TxForBudget[];

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.category_id && (tx.categories?.type === 'expense' || tx.amount < 0)) {
      const current = spentByCategory.get(tx.category_id) || 0;
      // Convert NUMERIC to cents
      const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
      spentByCategory.set(tx.category_id, current + amountCents);
    }
  }

  const headers = ['Mês', 'Categoria', 'Orçado (R$)', 'Gasto (R$)', 'Restante (R$)', '% Utilizado', 'Status'];
  const rows = budgets.map((b) => {
    const spent = spentByCategory.get(b.category_id) || 0;
    const budgetedCents = Math.round(b.amount_planned_cents || 0);
    const remaining = budgetedCents - spent;
    const percentage = budgetedCents > 0 ? (spent / budgetedCents) * 100 : 0;
    const status = percentage > 100 ? 'Acima' : percentage > 80 ? 'Próximo' : 'OK';

    return [
      formatDate(b.month),
      b.categories?.name || 'Categoria',
      formatCurrency(budgetedCents),
      formatCurrency(spent),
      formatCurrency(remaining),
      percentage.toFixed(1) + '%',
      status,
    ];
  });

  const filename = `orcamentos_${params.startDate}_${params.endDate}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}

async function exportGoals(
  supabase: SupabaseClient,
  userId: string
): Promise<{ csvContent: string; filename: string }> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, name, target_amount_cents, current_amount_cents, target_date, start_date, status, priority')
    .eq('user_id', userId);

  if (error) throw error;

  const goals = data as Goal[];

  const headers = ['Nome', 'Meta (R$)', 'Atual (R$)', 'Restante (R$)', '% Progresso', 'Data Início', 'Data Meta', 'Status', 'Prioridade'];
  const rows = goals.map((g) => {
    const remaining = g.target_amount_cents - g.current_amount_cents;
    const progress = g.target_amount_cents > 0 ? (g.current_amount_cents / g.target_amount_cents) * 100 : 0;
    const statusMap: Record<string, string> = {
      active: 'Ativo',
      completed: 'Concluído',
      paused: 'Pausado',
      cancelled: 'Cancelado',
    };
    const priorityMap: Record<string, string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
    };

    return [
      g.name,
      formatCurrency(g.target_amount_cents),
      formatCurrency(g.current_amount_cents),
      formatCurrency(remaining),
      progress.toFixed(1) + '%',
      g.start_date ? formatDate(g.start_date) : '',
      g.target_date ? formatDate(g.target_date) : '',
      statusMap[g.status] || g.status,
      priorityMap[g.priority] || g.priority,
    ];
  });

  const today = new Date().toISOString().split('T')[0];
  const filename = `objetivos_${today}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}

async function exportDebts(
  supabase: SupabaseClient,
  userId: string
): Promise<{ csvContent: string; filename: string }> {
  const { data, error } = await supabase
    .from('debts')
    .select('id, name, creditor_name, total_amount_cents, paid_amount_cents, interest_rate, due_date, status, priority')
    .eq('user_id', userId);

  if (error) throw error;

  const debts = data as Debt[];

  const headers = ['Nome', 'Credor', 'Total (R$)', 'Pago (R$)', 'Restante (R$)', '% Pago', 'Taxa Juros (%)', 'Vencimento', 'Status', 'Prioridade'];
  const rows = debts.map((d) => {
    const remaining = d.total_amount_cents - d.paid_amount_cents;
    const progress = d.total_amount_cents > 0 ? (d.paid_amount_cents / d.total_amount_cents) * 100 : 0;
    const statusMap: Record<string, string> = {
      active: 'Ativo',
      paid: 'Pago',
      overdue: 'Atrasado',
      negotiating: 'Negociando',
    };
    const priorityMap: Record<string, string> = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente',
    };

    return [
      d.name,
      d.creditor_name || '',
      formatCurrency(d.total_amount_cents),
      formatCurrency(d.paid_amount_cents),
      formatCurrency(remaining),
      progress.toFixed(1) + '%',
      d.interest_rate.toString().replace('.', ','),
      d.due_date ? formatDate(d.due_date) : '',
      statusMap[d.status] || d.status,
      priorityMap[d.priority] || d.priority,
    ];
  });

  const today = new Date().toISOString().split('T')[0];
  const filename = `dividas_${today}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}

async function exportInvestments(
  supabase: SupabaseClient,
  userId: string
): Promise<{ csvContent: string; filename: string }> {
  const { data, error } = await supabase
    .from('investments')
    .select('id, name, type, institution, initial_investment_cents, current_value_cents, purchase_date, status')
    .eq('user_id', userId);

  if (error) throw error;

  const investments = data as Investment[];

  const typeMap: Record<string, string> = {
    stocks: 'Ações',
    bonds: 'Renda Fixa',
    funds: 'Fundos',
    crypto: 'Criptomoedas',
    real_estate: 'Imóveis',
    other: 'Outros',
  };
  const statusMap: Record<string, string> = {
    active: 'Ativo',
    sold: 'Vendido',
    matured: 'Vencido',
  };

  const headers = ['Nome', 'Tipo', 'Instituição', 'Valor Investido (R$)', 'Valor Atual (R$)', 'Retorno (R$)', '% Retorno', 'Data Compra', 'Status'];
  const rows = investments.map((i) => {
    const currentValue = i.current_value_cents ?? i.initial_investment_cents;
    const returnAmount = currentValue - i.initial_investment_cents;
    const returnPct = i.initial_investment_cents > 0 ? (returnAmount / i.initial_investment_cents) * 100 : 0;

    return [
      i.name,
      typeMap[i.type] || i.type,
      i.institution || '',
      formatCurrency(i.initial_investment_cents),
      formatCurrency(currentValue),
      formatCurrency(returnAmount),
      returnPct.toFixed(2) + '%',
      formatDate(i.purchase_date),
      statusMap[i.status] || i.status,
    ];
  });

  const today = new Date().toISOString().split('T')[0];
  const filename = `investimentos_${today}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}

async function exportSummary(
  supabase: SupabaseClient,
  userId: string,
  params: ExportParams
): Promise<{ csvContent: string; filename: string }> {
  const [transactionsResult, accountsResult, goalsResult, debtsResult, investmentsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, categories(type)')
      .eq('user_id', userId)
      .gte('posted_at', params.startDate)
      .lte('posted_at', params.endDate),
    supabase.from('accounts').select('current_balance').eq('user_id', userId),
    supabase.from('goals').select('target_amount_cents, current_amount_cents, status').eq('user_id', userId),
    supabase.from('debts').select('total_amount_cents, paid_amount_cents, status').eq('user_id', userId),
    supabase.from('investments').select('initial_investment_cents, current_value_cents, status').eq('user_id', userId),
  ]);

  if (transactionsResult.error) throw transactionsResult.error;
  if (accountsResult.error) throw accountsResult.error;
  if (goalsResult.error) throw goalsResult.error;
  if (debtsResult.error) throw debtsResult.error;
  if (investmentsResult.error) throw investmentsResult.error;

  interface TxSummary {
    amount: number; // NUMERIC from DB
    categories?: { type: string } | null;
  }

  const transactions = transactionsResult.data as unknown as TxSummary[];
  let totalIncome = 0;
  let totalExpense = 0;
  for (const tx of transactions) {
    // Convert NUMERIC to cents
    const amountCents = Math.round(Math.abs(tx.amount || 0) * 100);
    const isIncome = tx.categories?.type === 'income' || tx.amount > 0;
    if (isIncome) {
      totalIncome += amountCents;
    } else {
      totalExpense += amountCents;
    }
  }

  interface AccountSummary {
    current_balance: number; // NUMERIC from DB
  }

  const accounts = accountsResult.data as AccountSummary[];
  // Convert NUMERIC to cents
  const totalBalance = accounts.reduce((sum, a) => sum + Math.round((a.current_balance || 0) * 100), 0);

  interface GoalSummary {
    target_amount_cents: number;
    current_amount_cents: number;
    status: string;
  }

  const goals = goalsResult.data as GoalSummary[];
  const activeGoals = goals.filter((g) => g.status === 'active');
  const totalGoalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount_cents, 0);
  const totalGoalCurrent = activeGoals.reduce((sum, g) => sum + g.current_amount_cents, 0);

  interface DebtSummary {
    total_amount_cents: number;
    paid_amount_cents: number;
    status: string;
  }

  const debts = debtsResult.data as DebtSummary[];
  const activeDebts = debts.filter((d) => d.status !== 'paid');
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.total_amount_cents, 0);
  const totalPaidDebt = activeDebts.reduce((sum, d) => sum + d.paid_amount_cents, 0);

  interface InvestmentSummary {
    initial_investment_cents: number;
    current_value_cents: number | null;
    status: string;
  }

  const investments = investmentsResult.data as InvestmentSummary[];
  const activeInvestments = investments.filter((i) => i.status === 'active');
  const totalInvested = activeInvestments.reduce((sum, i) => sum + i.initial_investment_cents, 0);
  const totalInvestmentValue = activeInvestments.reduce((sum, i) => sum + (i.current_value_cents ?? i.initial_investment_cents), 0);

  const headers = ['Métrica', 'Valor'];
  const rows: (string | number | null)[][] = [
    ['Período', `${formatDate(params.startDate)} a ${formatDate(params.endDate)}`],
    ['', ''],
    ['=== TRANSAÇÕES ===', ''],
    ['Total Receitas', `R$ ${formatCurrency(totalIncome)}`],
    ['Total Despesas', `R$ ${formatCurrency(totalExpense)}`],
    ['Saldo do Período', `R$ ${formatCurrency(totalIncome - totalExpense)}`],
    ['Taxa de Poupança', totalIncome > 0 ? `${(((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1)}%` : '0%'],
    ['', ''],
    ['=== CONTAS ===', ''],
    ['Saldo Total das Contas', `R$ ${formatCurrency(totalBalance)}`],
    ['', ''],
    ['=== OBJETIVOS ===', ''],
    ['Objetivos Ativos', activeGoals.length.toString()],
    ['Meta Total', `R$ ${formatCurrency(totalGoalTarget)}`],
    ['Acumulado', `R$ ${formatCurrency(totalGoalCurrent)}`],
    ['Progresso Geral', totalGoalTarget > 0 ? `${((totalGoalCurrent / totalGoalTarget) * 100).toFixed(1)}%` : '0%'],
    ['', ''],
    ['=== DÍVIDAS ===', ''],
    ['Dívidas Ativas', activeDebts.length.toString()],
    ['Total Dívidas', `R$ ${formatCurrency(totalDebt)}`],
    ['Total Pago', `R$ ${formatCurrency(totalPaidDebt)}`],
    ['Restante', `R$ ${formatCurrency(totalDebt - totalPaidDebt)}`],
    ['', ''],
    ['=== INVESTIMENTOS ===', ''],
    ['Investimentos Ativos', activeInvestments.length.toString()],
    ['Total Investido', `R$ ${formatCurrency(totalInvested)}`],
    ['Valor Atual', `R$ ${formatCurrency(totalInvestmentValue)}`],
    ['Retorno', `R$ ${formatCurrency(totalInvestmentValue - totalInvested)}`],
    ['% Retorno', totalInvested > 0 ? `${(((totalInvestmentValue - totalInvested) / totalInvested) * 100).toFixed(2)}%` : '0%'],
    ['', ''],
    ['=== PATRIMÔNIO LÍQUIDO ===', ''],
    ['Patrimônio Líquido', `R$ ${formatCurrency(totalBalance + totalInvestmentValue - (totalDebt - totalPaidDebt))}`],
  ];

  const filename = `resumo_financeiro_${params.startDate}_${params.endDate}.csv`;
  return { csvContent: arrayToCSV(headers, rows), filename };
}
