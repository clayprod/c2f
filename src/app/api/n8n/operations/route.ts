import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createErrorResponse } from '@/lib/errors';
import { getJobQueue } from '@/lib/queue/jobQueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGlobalSettings } from '@/services/admin/globalSettings';
import { getUserByPhoneNumber, normalizePhoneNumber } from '@/services/whatsapp/verification';

interface N8nOperationBody {
  operation: string;
  phone_number: string;
  data?: any;
  message_id?: string;
  buffer_message?: { text: string; type: 'text' | 'audio' };
}

function getApiKey(request: NextRequest) {
  return request.headers.get('x-n8n-api-key') || request.headers.get('X-N8N-API-KEY');
}

export async function POST(request: NextRequest) {
  try {
    const settings = await getGlobalSettings();
    if (!settings.n8n_api_key) {
      return NextResponse.json({ error: 'n8n api key não configurada' }, { status: 500 });
    }

    const apiKey = getApiKey(request);
    if (!apiKey || apiKey !== settings.n8n_api_key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!settings.whatsapp_enabled) {
      return NextResponse.json({ error: 'Integração WhatsApp não está disponível' }, { status: 403 });
    }

    const body = (await request.json()) as N8nOperationBody;
    if (!body?.operation) {
      return NextResponse.json({ error: 'operation é obrigatório' }, { status: 400 });
    }
    if (!body?.phone_number) {
      return NextResponse.json({ error: 'phone_number é obrigatório' }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneNumber(body.phone_number);
    const user = await getUserByPhoneNumber(normalizedPhone);
    if (!user) {
      return NextResponse.json({ error: 'Número não verificado' }, { status: 404 });
    }

    const jobId = randomUUID();
    const supabase = createAdminClient();

    const { error } = (await (supabase as any)
      .from('jobs')
      .insert({
        id: jobId,
        user_id: user.userId,
        type: 'n8n_operation',
        status: 'queued',
        payload: {
          operation: body.operation,
          phone_number: normalizedPhone,
          data: body.data || {},
          message_id: body.message_id || null,
          buffer_message: body.buffer_message || null,
          user: {
            userId: user.userId,
            fullName: user.fullName || null,
          },
        },
        progress: { processed: 0, total: 0 },
      })) as { error: { message: string } | null };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const queue = getJobQueue();
    await queue.add('job', { jobId });

    return NextResponse.json({ job_id: jobId });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
