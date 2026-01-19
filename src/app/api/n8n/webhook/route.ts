/**
 * n8n Webhook API
 *
 * POST: Receive webhook events from Evolution API or n8n
 *
 * This endpoint can be used to receive events directly from Evolution API
 * or as an intermediate step in the n8n workflow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { logWhatsAppMessage } from '@/services/whatsapp/transactions';
import { getUserByPhoneNumber, normalizePhoneNumber } from '@/services/whatsapp/verification';
import crypto from 'crypto';

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      audioMessage?: {
        url: string;
        mimetype: string;
      };
    };
    messageTimestamp: string;
    messageType: string;
  };
}

function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return true; // Skip validation if no signature or secret
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
}

export async function POST(request: NextRequest) {
  try {
    const settings = await getGlobalSettings();

    // Get raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') ||
                      request.headers.get('x-evolution-signature');

    // Validate signature if secret is configured
    if (settings.evolution_webhook_secret) {
      const isValid = validateWebhookSignature(
        rawBody,
        signature,
        settings.evolution_webhook_secret
      );

      if (!isValid) {
        console.error('[n8n Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Parse body
    const body: EvolutionWebhookPayload = JSON.parse(rawBody);

    // Only process MESSAGES_UPSERT events
    if (body.event !== 'MESSAGES_UPSERT') {
      return NextResponse.json({ received: true, processed: false, reason: 'Event type not supported' });
    }

    // Extract message data
    const { data } = body;

    // Skip messages from the bot itself
    if (data.key.fromMe) {
      return NextResponse.json({ received: true, processed: false, reason: 'Message from bot' });
    }

    // Skip group messages
    if (data.key.remoteJid.includes('@g.us')) {
      return NextResponse.json({ received: true, processed: false, reason: 'Group message' });
    }

    // Extract phone number from remoteJid (format: 5511999999999@s.whatsapp.net)
    const phoneMatch = data.key.remoteJid.match(/^(\d+)@/);
    if (!phoneMatch) {
      return NextResponse.json({ received: true, processed: false, reason: 'Invalid phone format' });
    }

    const phoneNumber = phoneMatch[1];

    // Get message content
    const messageText = data.message?.conversation ||
                       data.message?.extendedTextMessage?.text ||
                       '';

    const isAudio = !!data.message?.audioMessage;
    const messageType = isAudio ? 'audio' : 'text';

    // Check if user is registered
    const user = await getUserByPhoneNumber(phoneNumber);

    // Log the incoming message
    await logWhatsAppMessage(
      user?.userId || null,
      phoneNumber,
      'incoming',
      messageType,
      {
        contentSummary: isAudio ? '[Audio message]' : messageText.substring(0, 100),
        status: user ? 'pending' : 'ignored',
        errorMessage: user ? undefined : 'User not verified',
        metadata: {
          messageId: data.key.id,
          pushName: data.pushName,
          timestamp: data.messageTimestamp,
          isAudio,
        },
      }
    );

    // Return user info for n8n to process
    return NextResponse.json({
      received: true,
      processed: true,
      user_verified: !!user,
      phone_number: phoneNumber,
      message: {
        id: data.key.id,
        type: messageType,
        text: messageText,
        audio_url: data.message?.audioMessage?.url,
        timestamp: data.messageTimestamp,
        sender_name: data.pushName,
      },
      user: user ? {
        id: user.userId,
        name: user.fullName,
        email: user.email,
      } : null,
    });
  } catch (error: any) {
    console.error('[n8n Webhook] Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
