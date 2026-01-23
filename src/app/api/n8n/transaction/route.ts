/**
 * n8n Transaction API
 *
 * POST: Create, update, or delete a transaction via n8n workflow
 *
 * This endpoint is called by the n8n workflow after processing a WhatsApp message.
 * Authentication is done via API key in the header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserByPhoneNumber, normalizePhoneNumber } from '@/services/whatsapp/verification';
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
import { createAdminClient } from '@/lib/supabase/admin';
import { projectionCache } from '@/services/projections/cache';

async function validateN8nApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-n8n-api-key');
  if (!apiKey) {
    return false;
  }

  const settings = await getGlobalSettings();
  return apiKey === settings.n8n_api_key;
}

export async function POST(request: NextRequest) {
  // Validate API key
  const isValid = await validateN8nApiKey(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      action,
      phone_number,
      transaction,
    } = body;

    // Validate required fields
    if (!action || !phone_number) {
      return NextResponse.json({
        error: 'Missing required fields: action, phone_number',
      }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone_number);

    // Get user by phone number
    const user = await getUserByPhoneNumber(normalizedPhone);
    if (!user) {
      // Log as ignored (user not found)
      await logWhatsAppMessage(null, normalizedPhone, 'incoming', 'text', {
        status: 'ignored',
        errorMessage: 'User not found or phone not verified',
      });

      return NextResponse.json({
        success: false,
        error: 'Numero nao encontrado ou nao verificado',
        action_required: 'register',
        message: 'Por favor, cadastre e verifique seu numero no aplicativo c2Finance',
      }, { status: 404 });
    }

    // Handle different actions
    switch (action) {
      case 'create': {
        if (!transaction) {
          return NextResponse.json({
            error: 'Missing transaction data',
          }, { status: 400 });
        }

        const installmentTotal = transaction.installment_total || 1;

        // Check if it's an installment transaction
        if (installmentTotal > 1) {
          const result = await createInstallmentTransactionsFromWhatsApp({
            userId: user.userId,
            description: transaction.description || 'Compra parcelada via WhatsApp',
            totalAmountCents: Math.abs(transaction.amount_cents || 0),
            installmentTotal,
            postedAt: transaction.posted_at || new Date().toISOString().split('T')[0],
            categoryName: transaction.category_name,
            accountName: transaction.account_name,
            notes: transaction.notes,
          });

          // Log the message
          await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
            contentSummary: `Criar parcelado: ${transaction.description} (${installmentTotal}x)`,
            transactionId: result.parentTransactionId,
            actionType: 'create_installment',
            status: result.success ? 'processed' : 'failed',
            errorMessage: result.error,
          });

          if (!result.success) {
            return NextResponse.json({
              success: false,
              error: result.error,
            }, { status: 400 });
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
          description: transaction.description || 'Transacao via WhatsApp',
          amountCents: transaction.amount_cents || 0,
          postedAt: transaction.posted_at || new Date().toISOString().split('T')[0],
          categoryName: transaction.category_name,
          accountName: transaction.account_name,
          notes: transaction.notes,
        });

        // Log the message
        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Criar: ${transaction.description}`,
          transactionId: result.transactionId,
          actionType: 'create',
          status: result.success ? 'processed' : 'failed',
          errorMessage: result.error,
        });

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error,
          }, { status: 400 });
        }

        projectionCache.invalidateUser(user.userId);

        return NextResponse.json({
          success: true,
          transaction_id: result.transactionId,
          message: 'Transacao criada com sucesso',
        });
      }

      case 'update': {
        if (!transaction || !transaction.id) {
          return NextResponse.json({
            error: 'Missing transaction id',
          }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Verify transaction belongs to user
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('id', transaction.id)
          .eq('user_id', user.userId)
          .single();

        if (!existing) {
          return NextResponse.json({
            success: false,
            error: 'Transacao nao encontrada',
          }, { status: 404 });
        }

        // Update transaction
        const updates: any = {};
        if (transaction.description) updates.description = transaction.description;
        if (transaction.amount_cents !== undefined) {
          updates.amount = transaction.amount_cents >= 0 ? transaction.amount_cents : -Math.abs(transaction.amount_cents);
        }
        if (transaction.posted_at) updates.posted_at = transaction.posted_at;
        if (transaction.notes) updates.notes = transaction.notes;

        const { error: updateError } = await supabase
          .from('transactions')
          .update(updates)
          .eq('id', transaction.id);

        // Log the message
        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Atualizar: ${transaction.id}`,
          transactionId: transaction.id,
          actionType: 'update',
          status: updateError ? 'failed' : 'processed',
          errorMessage: updateError?.message,
        });

        if (updateError) {
          return NextResponse.json({
            success: false,
            error: 'Erro ao atualizar transacao',
          }, { status: 500 });
        }

        projectionCache.invalidateUser(user.userId);

        return NextResponse.json({
          success: true,
          transaction_id: transaction.id,
          message: 'Transacao atualizada com sucesso',
        });
      }

      case 'delete': {
        // Support deletion by: id, description search, or "última" (latest)
        const result = await deleteTransaction({
          userId: user.userId,
          transactionId: transaction?.id,
          searchDescription: transaction?.search_description,
          deleteLast: transaction?.delete_last === true,
        });

        // Log the message
        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Excluir: ${result.deletedTransaction?.description || transaction?.id || 'última'}`,
          transactionId: result.deletedTransaction?.id,
          actionType: 'delete',
          status: result.success ? 'processed' : 'failed',
          errorMessage: result.error,
        });

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error,
          }, { status: result.error?.includes('nao encontrada') ? 404 : 400 });
        }

        projectionCache.invalidateUser(user.userId);

        return NextResponse.json({
          success: true,
          deleted_transaction: result.deletedTransaction,
          message: `Transacao "${result.deletedTransaction?.description}" excluida com sucesso`,
        });
      }

      case 'query': {
        const queryType = body.query?.type || 'balance';

        if (queryType === 'balance') {
          const context = await getUserContextForAI(user.userId);
          if (!context) {
            return NextResponse.json({
              success: false,
              error: 'Erro ao obter contexto do usuario',
            }, { status: 500 });
          }

          const balanceInfo = formatBalanceInfo(context);

          // Log the query
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

        if (queryType === 'transactions') {
          const transactions = await getRecentTransactions(user.userId, {
            period: body.query?.period,
            fromDate: body.query?.from_date,
            toDate: body.query?.to_date,
            limit: body.query?.limit || 5,
          });

          const formattedList = formatTransactionsList(transactions);

          // Log the query
          await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
            contentSummary: `Consulta: ${transactions.length} transacoes`,
            actionType: 'query_transactions',
            status: 'processed',
          });

          return NextResponse.json({
            success: true,
            data: transactions.map((t) => ({
              id: t.id,
              description: t.description,
              amount: (t.amount / 100).toFixed(2),
              amount_formatted: `R$ ${(Math.abs(t.amount) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              type: t.amount >= 0 ? 'income' : 'expense',
              date: t.postedAt,
              category: t.categoryName,
              account: t.accountName,
            })),
            count: transactions.length,
            message: formattedList,
          });
        }

        return NextResponse.json({
          error: `Invalid query type: ${queryType}. Valid types: balance, transactions`,
        }, { status: 400 });
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}. Valid actions: create, update, delete, query`,
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[n8n Transaction] Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
