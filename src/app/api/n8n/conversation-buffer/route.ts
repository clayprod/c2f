/**
 * n8n Conversation Buffer API
 *
 * POST: Create or update conversation buffer
 * DELETE: Clear conversation buffer after action completed
 *
 * Used by n8n workflow to manage pending conversation state
 * when collecting information progressively from the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserByPhoneNumber, normalizePhoneNumber } from '@/services/whatsapp/verification';
import { createClient } from '@supabase/supabase-js';

// Admin client for service role operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function validateN8nApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('x-n8n-api-key');
  if (!apiKey) {
    return false;
  }

  const settings = await getGlobalSettings();
  return apiKey === settings.n8n_api_key;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface BufferData {
  phone_number: string;
  pending_intent?: string;
  pending_data?: Record<string, any>;
  clarification_field?: string;
  new_message?: ConversationMessage;
}

/**
 * POST /api/n8n/conversation-buffer
 *
 * Create or update the conversation buffer for a phone number.
 * Used when the AI needs to ask for clarification (intent = clarify).
 */
export async function POST(request: NextRequest) {
  const isValid = await validateN8nApiKey(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const body: BufferData = await request.json();
    const { phone_number, pending_intent, pending_data, clarification_field, new_message } = body;

    if (!phone_number) {
      return NextResponse.json({
        success: false,
        error: 'phone_number is required',
      }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(phone_number);

    // Get user to link buffer to user_id
    const user = await getUserByPhoneNumber(normalizedPhone);

    // Check if buffer exists
    const { data: existingBuffer } = await supabaseAdmin
      .from('whatsapp_conversation_buffer')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .single();

    // Prepare conversation history
    let conversationHistory: ConversationMessage[] = [];
    if (existingBuffer?.conversation_history) {
      conversationHistory = existingBuffer.conversation_history as ConversationMessage[];
    }

    // Add new message to history (keep last 5)
    if (new_message) {
      conversationHistory.push(new_message);
      if (conversationHistory.length > 5) {
        conversationHistory = conversationHistory.slice(-5);
      }
    }

    // Merge pending_data with existing if updating
    let mergedPendingData = pending_data || {};
    if (existingBuffer?.pending_data && pending_data) {
      mergedPendingData = {
        ...existingBuffer.pending_data,
        ...pending_data,
      };
    }

    const bufferPayload = {
      phone_number: normalizedPhone,
      user_id: user?.userId || null,
      pending_intent: pending_intent || existingBuffer?.pending_intent || null,
      pending_data: mergedPendingData,
      clarification_field: clarification_field || null,
      conversation_history: conversationHistory,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    };

    if (existingBuffer) {
      // Update existing buffer
      const { error } = await supabaseAdmin
        .from('whatsapp_conversation_buffer')
        .update(bufferPayload)
        .eq('phone_number', normalizedPhone);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        action: 'updated',
        buffer: bufferPayload,
      });
    } else {
      // Create new buffer
      const { error } = await supabaseAdmin
        .from('whatsapp_conversation_buffer')
        .insert({
          ...bufferPayload,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        action: 'created',
        buffer: bufferPayload,
      });
    }
  } catch (error: any) {
    console.error('[n8n Conversation Buffer] POST Error:', error);

    // Handle case where table doesn't exist yet
    if (error.code === '42P01') {
      return NextResponse.json({
        success: false,
        error: 'Buffer table not created yet. Run migration 073_whatsapp_conversation_buffer.sql',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/n8n/conversation-buffer
 *
 * Clear the conversation buffer after action is completed.
 * Called when the AI successfully completes an action (create_transaction, etc).
 */
export async function DELETE(request: NextRequest) {
  const isValid = await validateN8nApiKey(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone_number');

    if (!phoneNumber) {
      return NextResponse.json({
        success: false,
        error: 'phone_number query parameter is required',
      }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const { error, count } = await supabaseAdmin
      .from('whatsapp_conversation_buffer')
      .delete()
      .eq('phone_number', normalizedPhone);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      action: 'deleted',
      phone_number: normalizedPhone,
    });
  } catch (error: any) {
    console.error('[n8n Conversation Buffer] DELETE Error:', error);

    // Handle case where table doesn't exist yet
    if (error.code === '42P01') {
      return NextResponse.json({
        success: true,
        action: 'nothing_to_delete',
        message: 'Buffer table not created yet',
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * GET /api/n8n/conversation-buffer
 *
 * Get the current conversation buffer for a phone number.
 * Useful for debugging and monitoring.
 */
export async function GET(request: NextRequest) {
  const isValid = await validateN8nApiKey(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone_number');

    if (!phoneNumber) {
      return NextResponse.json({
        success: false,
        error: 'phone_number query parameter is required',
      }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const { data: buffer, error } = await supabaseAdmin
      .from('whatsapp_conversation_buffer')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!buffer) {
      return NextResponse.json({
        success: true,
        buffer: null,
        message: 'No active buffer found',
      });
    }

    return NextResponse.json({
      success: true,
      buffer: {
        pending_intent: buffer.pending_intent,
        pending_data: buffer.pending_data,
        clarification_field: buffer.clarification_field,
        conversation_history: buffer.conversation_history,
        created_at: buffer.created_at,
        updated_at: buffer.updated_at,
        expires_at: buffer.expires_at,
      },
    });
  } catch (error: any) {
    console.error('[n8n Conversation Buffer] GET Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
