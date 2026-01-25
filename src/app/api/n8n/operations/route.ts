/**
 * n8n Operations API (Extended)
 *
 * POST: Handle all financial operations from WhatsApp including:
 * - Transactions (create, update, delete, query)
 * - Budgets (create, update, query)
 * - Goals (create, update, query, contribute)
 * - Debts (create, update, query, pay)
 * - Subscriptions (create, update, query)
 * - Reports (generate summary, category breakdown)
 * - Categorization (auto-categorize by description)
 *
 * Also handles message buffering for multi-message contexts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserByPhoneNumber, normalizePhoneNumber } from '@/services/whatsapp/verification';
import { createAdminClient } from '@/lib/supabase/admin';
import { projectionCache } from '@/services/projections/cache';
import {
  createTransactionFromWhatsApp,
  createInstallmentTransactionsFromWhatsApp,
  logWhatsAppMessage,
  getRecentTransactions,
  getUserContextForAI,
  formatBalanceInfo,
  formatTransactionsList,
  deleteTransaction,
} from '@/services/whatsapp/transactions';
import {
  suggestFromHistory,
  normalizeDescription,
  extractCoreWords,
} from '@/services/categorization/historySuggester';

// Message buffer for multi-message aggregation (in-memory for simplicity)
// In production, use Redis or database
const messageBuffer: Map<string, {
  messages: Array<{ text: string; timestamp: number; type: 'text' | 'audio' }>;
  lastUpdate: number;
  processingTimeout: NodeJS.Timeout | null;
}> = new Map();

const MESSAGE_BUFFER_TIMEOUT_MS = 3000; // Wait 3 seconds for more messages

interface OperationRequest {
  operation: string;
  phone_number: string;
  data?: any;
  message_id?: string;
  buffer_message?: {
    text: string;
    type: 'text' | 'audio';
  };
}

async function validateN8nApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-n8n-api-key');
  if (!apiKey) return false;
  const settings = await getGlobalSettings();
  return apiKey === settings.n8n_api_key;
}

function formatCurrency(cents: number): string {
  const value = Math.abs(cents) / 100;
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function POST(request: NextRequest) {
  const isValid = await validateN8nApiKey(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const startTime = Date.now();
  let operation = 'unknown';

  try {
    const body: OperationRequest = await request.json();
    operation = body.operation;
    const normalizedPhone = normalizePhoneNumber(body.phone_number);

    // Get user
    const user = await getUserByPhoneNumber(normalizedPhone);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuário não encontrado ou não verificado',
        action_required: 'register',
      }, { status: 404 });
    }

    const supabase = createAdminClient();

    // Log operation start
    console.log(`[n8n Operations] ${operation} for user ${user.userId} (${normalizedPhone})`);

    // Handle different operations
    switch (body.operation) {
      // ==================== MESSAGE BUFFERING ====================
      case 'buffer_message': {
        const bufferData = body.buffer_message;
        if (!bufferData?.text) {
          return NextResponse.json({ error: 'Missing buffer_message.text' }, { status: 400 });
        }

        const bufferKey = `${normalizedPhone}`;
        const existing = messageBuffer.get(bufferKey);

        if (existing) {
          // Add to existing buffer
          existing.messages.push({
            text: bufferData.text,
            timestamp: Date.now(),
            type: bufferData.type || 'text',
          });
          existing.lastUpdate = Date.now();

          // Clear existing timeout
          if (existing.processingTimeout) {
            clearTimeout(existing.processingTimeout);
          }
        } else {
          // Create new buffer
          messageBuffer.set(bufferKey, {
            messages: [{
              text: bufferData.text,
              timestamp: Date.now(),
              type: bufferData.type || 'text',
            }],
            lastUpdate: Date.now(),
            processingTimeout: null,
          });
        }

        return NextResponse.json({
          success: true,
          buffered: true,
          message_count: messageBuffer.get(bufferKey)?.messages.length || 1,
          wait_ms: MESSAGE_BUFFER_TIMEOUT_MS,
        });
      }

      case 'get_buffered_messages': {
        const bufferKey = `${normalizedPhone}`;
        const buffer = messageBuffer.get(bufferKey);

        if (!buffer || buffer.messages.length === 0) {
          return NextResponse.json({
            success: true,
            messages: [],
            combined_text: '',
          });
        }

        // Check if enough time has passed
        const timeSinceLastMessage = Date.now() - buffer.lastUpdate;
        if (timeSinceLastMessage < MESSAGE_BUFFER_TIMEOUT_MS) {
          return NextResponse.json({
            success: true,
            should_wait: true,
            wait_ms: MESSAGE_BUFFER_TIMEOUT_MS - timeSinceLastMessage,
          });
        }

        // Combine messages and clear buffer
        const messages = [...buffer.messages];
        const combinedText = messages.map(m => m.text).join('\n');
        messageBuffer.delete(bufferKey);

        return NextResponse.json({
          success: true,
          messages,
          combined_text: combinedText,
          message_count: messages.length,
        });
      }

      // ==================== AUTO-CATEGORIZATION ====================
      case 'categorize': {
        const { description, amount } = body.data || {};
        if (!description) {
          return NextResponse.json({ error: 'Missing description' }, { status: 400 });
        }

        // Use existing categorization logic
        const transactions = [{
          id: 'temp',
          description,
          amount: amount || -100, // Default to expense
          date: new Date().toISOString().split('T')[0],
        }];

        const result = await suggestFromHistory(transactions, user.userId, supabase);

        if (result.matched.length > 0) {
          const match = result.matched[0];
          return NextResponse.json({
            success: true,
            category_name: match.category_name,
            category_id: match.category_id,
            confidence: match.confidence,
            match_type: match.match_type,
            source: 'history',
          });
        }

        // No history match - suggest based on keywords
        const normalized = normalizeDescription(description);
        const coreWords = extractCoreWords(description);

        // Common keyword mappings
        const keywordCategories: Record<string, string> = {
          'supermercado': 'Supermercado',
          'mercado': 'Supermercado',
          'uber': 'Transporte',
          '99': 'Transporte',
          'ifood': 'Alimentação',
          'rappi': 'Alimentação',
          'restaurante': 'Alimentação',
          'farmacia': 'Saúde',
          'drogaria': 'Saúde',
          'netflix': 'Assinaturas',
          'spotify': 'Assinaturas',
          'amazon': 'Compras',
          'magalu': 'Compras',
          'americanas': 'Compras',
          'salario': 'Salário',
          'aluguel': 'Moradia',
          'condominio': 'Moradia',
          'luz': 'Contas',
          'energia': 'Contas',
          'agua': 'Contas',
          'internet': 'Contas',
          'celular': 'Contas',
          'gasolina': 'Transporte',
          'combustivel': 'Transporte',
          'estacionamento': 'Transporte',
          'academia': 'Saúde',
          'medico': 'Saúde',
          'dentista': 'Saúde',
          'escola': 'Educação',
          'curso': 'Educação',
          'faculdade': 'Educação',
        };

        let suggestedCategory = 'Outros';
        for (const word of coreWords) {
          const lowerWord = word.toLowerCase();
          if (keywordCategories[lowerWord]) {
            suggestedCategory = keywordCategories[lowerWord];
            break;
          }
        }

        // Also check in normalized description
        for (const [keyword, category] of Object.entries(keywordCategories)) {
          if (normalized.includes(keyword)) {
            suggestedCategory = category;
            break;
          }
        }

        return NextResponse.json({
          success: true,
          category_name: suggestedCategory,
          category_id: null,
          confidence: 'low',
          match_type: 'keyword',
          source: 'inference',
        });
      }

      // ==================== TRANSACTION OPERATIONS ====================
      case 'create_transaction': {
        const tx = body.data;
        if (!tx) {
          return NextResponse.json({ error: 'Missing transaction data' }, { status: 400 });
        }

        const installmentTotal = tx.installment_total || 1;

        if (installmentTotal > 1) {
          const result = await createInstallmentTransactionsFromWhatsApp({
            userId: user.userId,
            description: tx.description || 'Compra parcelada via WhatsApp',
            totalAmountCents: Math.abs(tx.amount_cents || 0),
            installmentTotal,
            postedAt: tx.posted_at || new Date().toISOString().split('T')[0],
            categoryName: tx.category_name,
            accountName: tx.account_name,
            notes: tx.notes,
          });

          await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
            contentSummary: `Criar parcelado: ${tx.description} (${installmentTotal}x)`,
            transactionId: result.parentTransactionId,
            actionType: 'create_installment',
            status: result.success ? 'processed' : 'failed',
            errorMessage: result.error,
          });

          if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
          }

          projectionCache.invalidateUser(user.userId);

          return NextResponse.json({
            success: true,
            transaction_id: result.parentTransactionId,
            installments_created: result.installmentsCreated,
            message: `Compra parcelada em ${installmentTotal}x criada com sucesso`,
          });
        }

        // Single transaction
        const result = await createTransactionFromWhatsApp({
          userId: user.userId,
          description: tx.description || 'Transação via WhatsApp',
          amountCents: tx.amount_cents || 0,
          postedAt: tx.posted_at || new Date().toISOString().split('T')[0],
          categoryName: tx.category_name,
          accountName: tx.account_name,
          notes: tx.notes,
        });

        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Criar: ${tx.description}`,
          transactionId: result.transactionId,
          actionType: 'create',
          status: result.success ? 'processed' : 'failed',
          errorMessage: result.error,
        });

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        projectionCache.invalidateUser(user.userId);

        return NextResponse.json({
          success: true,
          transaction_id: result.transactionId,
          message: 'Transação criada com sucesso',
        });
      }

      case 'delete_transaction': {
        const result = await deleteTransaction({
          userId: user.userId,
          transactionId: body.data?.id,
          searchDescription: body.data?.search_description,
          deleteLast: body.data?.delete_last === true,
        });

        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Excluir: ${result.deletedTransaction?.description || body.data?.id || 'última'}`,
          transactionId: result.deletedTransaction?.id,
          actionType: 'delete',
          status: result.success ? 'processed' : 'failed',
          errorMessage: result.error,
        });

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error,
          }, { status: result.error?.includes('não encontrada') ? 404 : 400 });
        }

        projectionCache.invalidateUser(user.userId);

        return NextResponse.json({
          success: true,
          deleted_transaction: result.deletedTransaction,
          message: `Transação "${result.deletedTransaction?.description}" excluída com sucesso`,
        });
      }

      case 'query_balance': {
        const context = await getUserContextForAI(user.userId);
        if (!context) {
          return NextResponse.json({ success: false, error: 'Erro ao obter contexto' }, { status: 500 });
        }

        const balanceInfo = formatBalanceInfo(context);

        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: 'Consulta: saldo',
          actionType: 'query_balance',
          status: 'processed',
        });

        return NextResponse.json({
          success: true,
          data: balanceInfo,
          message: balanceInfo.formattedMessage,
        });
      }

      case 'list_transactions': {
        const transactions = await getRecentTransactions(user.userId, {
          period: body.data?.period,
          fromDate: body.data?.from_date,
          toDate: body.data?.to_date,
          limit: body.data?.limit || 10,
        });

        const formattedList = formatTransactionsList(transactions);

        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Consulta: ${transactions.length} transações`,
          actionType: 'query_transactions',
          status: 'processed',
        });

        return NextResponse.json({
          success: true,
          data: transactions.map((t) => ({
            id: t.id,
            description: t.description,
            amount_cents: t.amount,
            amount_formatted: formatCurrency(t.amount),
            type: t.amount >= 0 ? 'income' : 'expense',
            date: t.postedAt,
            category: t.categoryName,
            account: t.accountName,
          })),
          count: transactions.length,
          message: formattedList,
        });
      }

      // ==================== BUDGET OPERATIONS ====================
      case 'query_budgets': {
        const month = body.data?.month || new Date().toISOString().slice(0, 7);

        const { data: budgets, error } = await supabase
          .from('budgets')
          .select(`
            id,
            year,
            month,
            amount_planned_cents,
            categories (
              id,
              name,
              type,
              icon
            )
          `)
          .eq('user_id', user.userId)
          .eq('year', parseInt(month.split('-')[0]))
          .eq('month', parseInt(month.split('-')[1]));

        if (error) {
          return NextResponse.json({ success: false, error: 'Erro ao buscar orçamentos' }, { status: 500 });
        }

        // Calculate actual spending per category
        const startDate = `${month}-01`;
        const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
          .toISOString().split('T')[0];

        const { data: transactions } = await supabase
          .from('transactions')
          .select('category_id, amount')
          .eq('user_id', user.userId)
          .gte('posted_at', startDate)
          .lte('posted_at', endDate)
          .lt('amount', 0);

        const spentByCategory: Record<string, number> = {};
        for (const tx of transactions || []) {
          if (tx.category_id) {
            spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] || 0) + Math.abs(tx.amount * 100);
          }
        }

        const formattedBudgets = (budgets || []).map((b: any) => ({
          id: b.id,
          category_name: b.categories?.name || 'Sem categoria',
          planned_cents: b.amount_planned_cents,
          planned_formatted: formatCurrency(b.amount_planned_cents),
          spent_cents: spentByCategory[b.categories?.id] || 0,
          spent_formatted: formatCurrency(spentByCategory[b.categories?.id] || 0),
          remaining_cents: b.amount_planned_cents - (spentByCategory[b.categories?.id] || 0),
          percentage_used: Math.round(((spentByCategory[b.categories?.id] || 0) / b.amount_planned_cents) * 100),
        }));

        let message = `📊 *Orçamentos de ${month}*\n\n`;
        for (const b of formattedBudgets) {
          const emoji = b.percentage_used > 100 ? '🔴' : b.percentage_used > 80 ? '🟡' : '🟢';
          message += `${emoji} *${b.category_name}*\n`;
          message += `   Planejado: ${b.planned_formatted}\n`;
          message += `   Gasto: ${b.spent_formatted} (${b.percentage_used}%)\n\n`;
        }

        return NextResponse.json({
          success: true,
          data: formattedBudgets,
          month,
          message,
        });
      }

      case 'update_budget': {
        const { category_name, amount_cents, month } = body.data || {};
        if (!category_name || !amount_cents) {
          return NextResponse.json({ error: 'Missing category_name or amount_cents' }, { status: 400 });
        }

        const targetMonth = month || new Date().toISOString().slice(0, 7);
        const [year, monthNum] = targetMonth.split('-').map(Number);

        // Find category
        const { data: category } = await supabase
          .from('categories')
          .select('id, name')
          .eq('user_id', user.userId)
          .ilike('name', category_name)
          .single();

        if (!category) {
          return NextResponse.json({
            success: false,
            error: `Categoria "${category_name}" não encontrada`,
          }, { status: 404 });
        }

        // Upsert budget
        const { data: budget, error } = await supabase
          .from('budgets')
          .upsert({
            user_id: user.userId,
            category_id: category.id,
            year,
            month: monthNum,
            amount_planned_cents: amount_cents,
          }, {
            onConflict: 'user_id,category_id,year,month',
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: 'Erro ao atualizar orçamento' }, { status: 500 });
        }

        projectionCache.invalidateUser(user.userId);

        return NextResponse.json({
          success: true,
          budget_id: budget.id,
          message: `Orçamento de "${category.name}" atualizado para ${formatCurrency(amount_cents)} em ${targetMonth}`,
        });
      }

      // ==================== GOAL OPERATIONS ====================
      case 'query_goals': {
        const { data: goals, error } = await supabase
          .from('goals')
          .select(`
            id,
            name,
            description,
            target_amount_cents,
            current_amount_cents,
            target_date,
            status,
            monthly_contribution_cents
          `)
          .eq('user_id', user.userId)
          .eq('status', 'active');

        if (error) {
          return NextResponse.json({ success: false, error: 'Erro ao buscar metas' }, { status: 500 });
        }

        let message = `🎯 *Suas Metas*\n\n`;
        for (const g of goals || []) {
          const progress = Math.round((g.current_amount_cents / g.target_amount_cents) * 100);
          const remaining = g.target_amount_cents - g.current_amount_cents;
          message += `*${g.name}*\n`;
          message += `   Meta: ${formatCurrency(g.target_amount_cents)}\n`;
          message += `   Atual: ${formatCurrency(g.current_amount_cents)} (${progress}%)\n`;
          message += `   Falta: ${formatCurrency(remaining)}\n`;
          if (g.target_date) {
            message += `   Prazo: ${new Date(g.target_date).toLocaleDateString('pt-BR')}\n`;
          }
          if (g.monthly_contribution_cents) {
            message += `   Aporte mensal: ${formatCurrency(g.monthly_contribution_cents)}\n`;
          }
          message += '\n';
        }

        if ((goals || []).length === 0) {
          message = 'Você ainda não tem metas cadastradas. Que tal criar uma?';
        }

        return NextResponse.json({
          success: true,
          data: goals,
          count: (goals || []).length,
          message,
        });
      }

      case 'create_goal': {
        const { name, target_amount_cents, target_date, description, monthly_contribution_cents } = body.data || {};
        if (!name || !target_amount_cents) {
          return NextResponse.json({ error: 'Missing name or target_amount_cents' }, { status: 400 });
        }

        // Create category for the goal
        const { data: category, error: catError } = await supabase
          .from('categories')
          .insert({
            user_id: user.userId,
            name: `Meta: ${name}`,
            type: 'expense',
            source_type: 'goal',
            icon: 'bx-target-lock',
            color: '#10B981',
          })
          .select()
          .single();

        if (catError) {
          return NextResponse.json({ success: false, error: 'Erro ao criar categoria da meta' }, { status: 500 });
        }

        // Calculate monthly contribution if not provided
        let monthlyContribution = monthly_contribution_cents;
        if (!monthlyContribution && target_date) {
          const now = new Date();
          const targetDateObj = new Date(target_date);
          const monthsRemaining = Math.max(1,
            (targetDateObj.getFullYear() - now.getFullYear()) * 12 +
            (targetDateObj.getMonth() - now.getMonth())
          );
          monthlyContribution = Math.ceil(target_amount_cents / monthsRemaining);
        }

        const { data: goal, error } = await supabase
          .from('goals')
          .insert({
            user_id: user.userId,
            name,
            description,
            target_amount_cents,
            current_amount_cents: 0,
            target_date,
            status: 'active',
            category_id: category.id,
            monthly_contribution_cents: monthlyContribution,
            include_in_budget: true,
            contribution_frequency: 'monthly',
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: 'Erro ao criar meta' }, { status: 500 });
        }

        projectionCache.invalidateUser(user.userId);

        let message = `🎯 Meta "${name}" criada com sucesso!\n\n`;
        message += `Meta: ${formatCurrency(target_amount_cents)}\n`;
        if (target_date) {
          message += `Prazo: ${new Date(target_date).toLocaleDateString('pt-BR')}\n`;
        }
        if (monthlyContribution) {
          message += `Aporte sugerido: ${formatCurrency(monthlyContribution)}/mês`;
        }

        return NextResponse.json({
          success: true,
          goal_id: goal.id,
          category_id: category.id,
          monthly_contribution_cents: monthlyContribution,
          message,
        });
      }

      case 'contribute_goal': {
        const { goal_name, amount_cents } = body.data || {};
        if (!goal_name || !amount_cents) {
          return NextResponse.json({ error: 'Missing goal_name or amount_cents' }, { status: 400 });
        }

        // Find goal
        const { data: goal } = await supabase
          .from('goals')
          .select('id, name, target_amount_cents, current_amount_cents, category_id')
          .eq('user_id', user.userId)
          .ilike('name', `%${goal_name}%`)
          .eq('status', 'active')
          .single();

        if (!goal) {
          return NextResponse.json({
            success: false,
            error: `Meta "${goal_name}" não encontrada`,
          }, { status: 404 });
        }

        // Create transaction for the contribution
        const result = await createTransactionFromWhatsApp({
          userId: user.userId,
          description: `Aporte para meta: ${goal.name}`,
          amountCents: -Math.abs(amount_cents),
          postedAt: new Date().toISOString().split('T')[0],
          categoryName: `Meta: ${goal.name}`,
        });

        // Update goal current amount
        const newAmount = goal.current_amount_cents + Math.abs(amount_cents);
        await supabase
          .from('goals')
          .update({
            current_amount_cents: newAmount,
            status: newAmount >= goal.target_amount_cents ? 'achieved' : 'active',
          })
          .eq('id', goal.id);

        projectionCache.invalidateUser(user.userId);

        const progress = Math.round((newAmount / goal.target_amount_cents) * 100);
        let message = `💰 Aporte de ${formatCurrency(Math.abs(amount_cents))} para "${goal.name}" registrado!\n\n`;
        message += `Progresso: ${formatCurrency(newAmount)} de ${formatCurrency(goal.target_amount_cents)} (${progress}%)`;

        if (newAmount >= goal.target_amount_cents) {
          message += '\n\n🎉 Parabéns! Você atingiu sua meta!';
        }

        return NextResponse.json({
          success: true,
          goal_id: goal.id,
          new_amount_cents: newAmount,
          progress_percentage: progress,
          message,
        });
      }

      // ==================== DEBT OPERATIONS ====================
      case 'query_debts': {
        const { data: debts, error } = await supabase
          .from('debts')
          .select(`
            id,
            name,
            creditor,
            total_amount_cents,
            paid_amount_cents,
            due_date,
            priority,
            status,
            installment_count,
            monthly_payment_cents
          `)
          .eq('user_id', user.userId)
          .in('status', ['active', 'negotiating', 'negociando']);

        if (error) {
          return NextResponse.json({ success: false, error: 'Erro ao buscar dívidas' }, { status: 500 });
        }

        let message = `💳 *Suas Dívidas*\n\n`;
        let totalDebt = 0;
        let totalPaid = 0;

        for (const d of debts || []) {
          const remaining = d.total_amount_cents - (d.paid_amount_cents || 0);
          totalDebt += d.total_amount_cents;
          totalPaid += d.paid_amount_cents || 0;

          const priorityEmoji = d.priority === 'high' ? '🔴' : d.priority === 'medium' ? '🟡' : '🟢';
          message += `${priorityEmoji} *${d.name}*`;
          if (d.creditor) message += ` (${d.creditor})`;
          message += '\n';
          message += `   Total: ${formatCurrency(d.total_amount_cents)}\n`;
          message += `   Pago: ${formatCurrency(d.paid_amount_cents || 0)}\n`;
          message += `   Restante: ${formatCurrency(remaining)}\n`;
          if (d.monthly_payment_cents) {
            message += `   Parcela: ${formatCurrency(d.monthly_payment_cents)}\n`;
          }
          if (d.due_date) {
            message += `   Vencimento: ${new Date(d.due_date).toLocaleDateString('pt-BR')}\n`;
          }
          message += '\n';
        }

        if ((debts || []).length === 0) {
          message = '🎉 Você não tem dívidas cadastradas. Continue assim!';
        } else {
          message += `\n📊 *Resumo*\n`;
          message += `Total em dívidas: ${formatCurrency(totalDebt)}\n`;
          message += `Total pago: ${formatCurrency(totalPaid)}\n`;
          message += `Restante: ${formatCurrency(totalDebt - totalPaid)}`;
        }

        return NextResponse.json({
          success: true,
          data: debts,
          count: (debts || []).length,
          total_debt_cents: totalDebt,
          total_paid_cents: totalPaid,
          message,
        });
      }

      case 'create_debt': {
        const {
          name,
          creditor,
          total_amount_cents,
          due_date,
          priority,
          installment_count,
          monthly_payment_cents,
        } = body.data || {};

        if (!name || !total_amount_cents) {
          return NextResponse.json({ error: 'Missing name or total_amount_cents' }, { status: 400 });
        }

        // Create category for the debt
        const { data: category, error: catError } = await supabase
          .from('categories')
          .insert({
            user_id: user.userId,
            name: `Dívida: ${name}`,
            type: 'expense',
            source_type: 'debt',
            icon: 'bx-credit-card',
            color: '#EF4444',
          })
          .select()
          .single();

        if (catError) {
          return NextResponse.json({ success: false, error: 'Erro ao criar categoria' }, { status: 500 });
        }

        const { data: debt, error } = await supabase
          .from('debts')
          .insert({
            user_id: user.userId,
            name,
            creditor,
            total_amount_cents,
            paid_amount_cents: 0,
            due_date,
            priority: priority || 'medium',
            status: 'active',
            category_id: category.id,
            installment_count,
            monthly_payment_cents: monthly_payment_cents || (installment_count ? Math.ceil(total_amount_cents / installment_count) : null),
            include_in_budget: true,
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: 'Erro ao criar dívida' }, { status: 500 });
        }

        projectionCache.invalidateUser(user.userId);

        let message = `💳 Dívida "${name}" cadastrada!\n\n`;
        message += `Valor total: ${formatCurrency(total_amount_cents)}\n`;
        if (creditor) message += `Credor: ${creditor}\n`;
        if (installment_count) {
          const parcela = Math.ceil(total_amount_cents / installment_count);
          message += `Parcelas: ${installment_count}x de ${formatCurrency(parcela)}\n`;
        }
        if (due_date) {
          message += `Vencimento: ${new Date(due_date).toLocaleDateString('pt-BR')}`;
        }

        return NextResponse.json({
          success: true,
          debt_id: debt.id,
          category_id: category.id,
          message,
        });
      }

      case 'pay_debt': {
        const { debt_name, amount_cents } = body.data || {};
        if (!debt_name || !amount_cents) {
          return NextResponse.json({ error: 'Missing debt_name or amount_cents' }, { status: 400 });
        }

        // Find debt
        const { data: debt } = await supabase
          .from('debts')
          .select('id, name, total_amount_cents, paid_amount_cents, category_id')
          .eq('user_id', user.userId)
          .ilike('name', `%${debt_name}%`)
          .in('status', ['active', 'negotiating', 'negociando'])
          .single();

        if (!debt) {
          return NextResponse.json({
            success: false,
            error: `Dívida "${debt_name}" não encontrada`,
          }, { status: 404 });
        }

        // Create transaction for the payment
        await createTransactionFromWhatsApp({
          userId: user.userId,
          description: `Pagamento dívida: ${debt.name}`,
          amountCents: -Math.abs(amount_cents),
          postedAt: new Date().toISOString().split('T')[0],
          categoryName: `Dívida: ${debt.name}`,
        });

        // Update debt paid amount
        const newPaidAmount = (debt.paid_amount_cents || 0) + Math.abs(amount_cents);
        const isPaid = newPaidAmount >= debt.total_amount_cents;

        await supabase
          .from('debts')
          .update({
            paid_amount_cents: newPaidAmount,
            status: isPaid ? 'paid' : 'active',
          })
          .eq('id', debt.id);

        projectionCache.invalidateUser(user.userId);

        const remaining = debt.total_amount_cents - newPaidAmount;
        let message = `💰 Pagamento de ${formatCurrency(Math.abs(amount_cents))} registrado para "${debt.name}"!\n\n`;
        message += `Total pago: ${formatCurrency(newPaidAmount)}\n`;
        message += `Restante: ${formatCurrency(Math.max(0, remaining))}`;

        if (isPaid) {
          message += '\n\n🎉 Parabéns! Dívida quitada!';
        }

        return NextResponse.json({
          success: true,
          debt_id: debt.id,
          new_paid_amount_cents: newPaidAmount,
          remaining_cents: Math.max(0, remaining),
          is_paid: isPaid,
          message,
        });
      }

      // ==================== REPORT OPERATIONS ====================
      case 'generate_report': {
        const month = body.data?.month || new Date().toISOString().slice(0, 7);
        const [year, monthNum] = month.split('-').map(Number);

        const startDate = `${month}-01`;
        const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

        // Get transactions for the month
        const { data: transactions } = await supabase
          .from('transactions')
          .select(`
            id,
            description,
            amount,
            posted_at,
            categories (
              id,
              name,
              type
            )
          `)
          .eq('user_id', user.userId)
          .gte('posted_at', startDate)
          .lte('posted_at', endDate)
          .order('posted_at', { ascending: false });

        // Calculate totals by category
        const categoryTotals: Record<string, { name: string; total: number; count: number; type: string }> = {};
        let totalIncome = 0;
        let totalExpenses = 0;

        for (const tx of transactions || []) {
          const cat = tx.categories as any;
          const categoryName = cat?.name || 'Sem categoria';
          const categoryType = cat?.type || (tx.amount >= 0 ? 'income' : 'expense');

          if (!categoryTotals[categoryName]) {
            categoryTotals[categoryName] = { name: categoryName, total: 0, count: 0, type: categoryType };
          }
          categoryTotals[categoryName].total += tx.amount * 100;
          categoryTotals[categoryName].count++;

          if (tx.amount >= 0) {
            totalIncome += tx.amount * 100;
          } else {
            totalExpenses += Math.abs(tx.amount * 100);
          }
        }

        // Sort categories by absolute total
        const sortedCategories = Object.values(categoryTotals)
          .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

        // Format message
        const monthName = new Date(year, monthNum - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        let message = `📊 *Relatório de ${monthName}*\n\n`;

        message += `💰 *Resumo*\n`;
        message += `   Receitas: ${formatCurrency(totalIncome)}\n`;
        message += `   Despesas: ${formatCurrency(totalExpenses)}\n`;
        message += `   Saldo: ${formatCurrency(totalIncome - totalExpenses)}\n\n`;

        message += `📈 *Por Categoria*\n`;
        for (const cat of sortedCategories.slice(0, 10)) {
          const emoji = cat.type === 'income' ? '🟢' : '🔴';
          message += `${emoji} ${cat.name}: ${formatCurrency(Math.abs(cat.total))} (${cat.count}x)\n`;
        }

        if (sortedCategories.length > 10) {
          message += `... e mais ${sortedCategories.length - 10} categorias`;
        }

        return NextResponse.json({
          success: true,
          data: {
            month,
            total_income_cents: totalIncome,
            total_expenses_cents: totalExpenses,
            balance_cents: totalIncome - totalExpenses,
            transaction_count: (transactions || []).length,
            categories: sortedCategories,
          },
          message,
        });
      }

      // ==================== EXTENDED CONTEXT ====================
      case 'get_context': {
        const context = await getUserContextForAI(user.userId);
        if (!context) {
          return NextResponse.json({ success: false, error: 'Erro ao obter contexto' }, { status: 500 });
        }

        // Also get goals and debts summary
        const { data: goals } = await supabase
          .from('goals')
          .select('id, name, target_amount_cents, current_amount_cents, status')
          .eq('user_id', user.userId)
          .eq('status', 'active');

        const { data: debts } = await supabase
          .from('debts')
          .select('id, name, total_amount_cents, paid_amount_cents, status')
          .eq('user_id', user.userId)
          .in('status', ['active', 'negotiating', 'negociando']);

        return NextResponse.json({
          success: true,
          verified: true, // User is verified if we reached this point
          user: {
            id: user.userId,
            name: user.fullName || 'Usuário',
          },
          ...context,
          goals: (goals || []).map(g => ({
            id: g.id,
            name: g.name,
            target_cents: g.target_amount_cents,
            current_cents: g.current_amount_cents,
            progress: Math.round((g.current_amount_cents / g.target_amount_cents) * 100),
          })),
          debts: (debts || []).map(d => ({
            id: d.id,
            name: d.name,
            total_cents: d.total_amount_cents,
            paid_cents: d.paid_amount_cents || 0,
            remaining_cents: d.total_amount_cents - (d.paid_amount_cents || 0),
          })),
        });
      }

      default:
        return NextResponse.json({
          error: `Invalid operation: ${body.operation}`,
          valid_operations: [
            'buffer_message', 'get_buffered_messages',
            'categorize',
            'create_transaction', 'delete_transaction', 'query_balance', 'list_transactions',
            'query_budgets', 'update_budget',
            'query_goals', 'create_goal', 'contribute_goal',
            'query_debts', 'create_debt', 'pay_debt',
            'generate_report',
            'get_context',
          ],
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[n8n Operations] Error in ${operation}:`, error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      operation,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}
