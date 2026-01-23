/**
 * n8n User Context API
 *
 * GET: Get user context for AI agent in n8n workflow
 *
 * Returns accounts, categories, recent transactions, and summary
 * for the AI to use when processing WhatsApp messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserByPhoneNumber, normalizePhoneNumber } from '@/services/whatsapp/verification';
import { getUserContextForAI } from '@/services/whatsapp/transactions';

async function validateN8nApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-n8n-api-key');
  if (!apiKey) {
    return false;
  }

  const settings = await getGlobalSettings();
  return apiKey === settings.n8n_api_key;
}

export async function GET(request: NextRequest) {
  // Validate API key
  const isValid = await validateN8nApiKey(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone_number');

    if (!phoneNumber) {
      return NextResponse.json({
        error: 'Missing phone_number parameter',
      }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Get user by phone number
    const user = await getUserByPhoneNumber(normalizedPhone);
    if (!user) {
      return NextResponse.json({
        verified: false,
        error: 'Número não encontrado ou não verificado',
        action_required: 'register',
        message: 'Por favor, cadastre e verifique seu número no aplicativo c2Finance em app.c2finance.com.br',
      }, { status: 404 });
    }

    // Get user context
    const context = await getUserContextForAI(user.userId);

    if (!context) {
      return NextResponse.json({
        verified: true,
        error: 'Erro ao obter contexto do usuário',
      }, { status: 500 });
    }

    // Format context for AI
    const formattedContext = {
      verified: true,
      user: {
        id: user.userId,
        name: user.fullName || user.email,
        email: user.email,
      },
      accounts: context.accounts
        .filter((a) => a.type !== 'credit_card')
        .map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: (a.currentBalance / 100).toFixed(2),
          balance_formatted: `R$ ${(a.currentBalance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        })),
      credit_cards: context.creditCards.map((cc) => ({
        id: cc.id,
        name: cc.name,
        closing_day: cc.closingDay,
        due_day: cc.dueDay,
        credit_limit: (cc.creditLimitCents / 100).toFixed(2),
        credit_limit_formatted: `R$ ${(cc.creditLimitCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        available_limit: (cc.availableLimitCents / 100).toFixed(2),
        available_limit_formatted: `R$ ${(cc.availableLimitCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        current_bill: (cc.currentBillCents / 100).toFixed(2),
        current_bill_formatted: `R$ ${(cc.currentBillCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      })),
      categories: {
        income: context.categories
          .filter((c) => c.type === 'income')
          .map((c) => ({ id: c.id, name: c.name })),
        expense: context.categories
          .filter((c) => c.type === 'expense')
          .map((c) => ({ id: c.id, name: c.name })),
      },
      recent_transactions: context.recentTransactions.slice(0, 10).map((t) => ({
        id: t.id,
        description: t.description,
        amount: (t.amount / 100).toFixed(2),
        amount_formatted: `R$ ${(Math.abs(t.amount) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        type: t.amount >= 0 ? 'income' : 'expense',
        date: t.postedAt,
        category: t.categoryName,
        account: t.accountName,
      })),
      summary: {
        total_balance: (context.summary.totalBalance / 100).toFixed(2),
        total_balance_formatted: `R$ ${(context.summary.totalBalance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        monthly_income: (context.summary.monthlyIncome / 100).toFixed(2),
        monthly_income_formatted: `R$ ${(context.summary.monthlyIncome / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        monthly_expenses: (context.summary.monthlyExpenses / 100).toFixed(2),
        monthly_expenses_formatted: `R$ ${(context.summary.monthlyExpenses / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        monthly_balance: ((context.summary.monthlyIncome - context.summary.monthlyExpenses) / 100).toFixed(2),
        monthly_balance_formatted: `R$ ${((context.summary.monthlyIncome - context.summary.monthlyExpenses) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      },
      // Helpful context for the AI
      instructions: {
        currency: 'BRL (Real Brasileiro)',
        date_format: 'YYYY-MM-DD',
        amount_unit: 'centavos (dividir por 100 para reais)',
        default_account: context.accounts.find((a) => a.type !== 'credit_card')?.name || null,
        credit_cards_available: context.creditCards.map((cc) => cc.name),
      },
    };

    return NextResponse.json(formattedContext);
  } catch (error: any) {
    console.error('[n8n User Context] Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
