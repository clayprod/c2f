import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getJobQueue } from '@/lib/queue/jobQueue';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { createClientFromRequest } from '@/lib/supabase/server';

interface StartJobBody {
  type: string;
  payload?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = (await request.json()) as StartJobBody;
    const { type, payload } = body;

    if (!type) {
      return NextResponse.json({ error: 'type é obrigatório' }, { status: 400 });
    }

    const { supabase } = createClientFromRequest(request);
    const jobId = randomUUID();

    const { error } = (await (supabase as any)
      .from('jobs')
      .insert({
        id: jobId,
        user_id: ownerId,
        type,
        status: 'queued',
        payload: payload || {},
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
