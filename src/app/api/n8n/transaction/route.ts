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
  logWhatsAppMessage,
} from '@/services/whatsapp/transactions';
import { createClient } from '@/lib/supabase/server';

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

        const supabase = await createClient();

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

        return NextResponse.json({
          success: true,
          transaction_id: transaction.id,
          message: 'Transacao atualizada com sucesso',
        });
      }

      case 'delete': {
        if (!transaction || !transaction.id) {
          return NextResponse.json({
            error: 'Missing transaction id',
          }, { status: 400 });
        }

        const supabase = await createClient();

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

        // Delete transaction
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', transaction.id);

        // Log the message
        await logWhatsAppMessage(user.userId, normalizedPhone, 'incoming', 'text', {
          contentSummary: `Excluir: ${transaction.id}`,
          transactionId: transaction.id,
          actionType: 'delete',
          status: deleteError ? 'failed' : 'processed',
          errorMessage: deleteError?.message,
        });

        if (deleteError) {
          return NextResponse.json({
            success: false,
            error: 'Erro ao excluir transacao',
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Transacao excluida com sucesso',
        });
      }

      default:
        return NextResponse.json({
          error: `Invalid action: ${action}. Valid actions: create, update, delete`,
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[n8n Transaction] Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
