import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getJobQueue } from '@/lib/queue/jobQueue';
import { randomUUID } from 'crypto';

interface TransactionToImport {
  id: string;
  category_id?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { link_id, transactions: transactionsToImport } = body as {
      link_id: string;
      transactions: TransactionToImport[];
    };

    if (!link_id || !transactionsToImport || transactionsToImport.length === 0) {
      return NextResponse.json(
        { error: 'link_id and transactions are required' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);
    const jobId = randomUUID();

    const { error: jobError } = (await (supabase as any)
      .from('jobs')
      .insert({
        id: jobId,
        user_id: userId,
        type: 'openfinance_import',
        status: 'queued',
        payload: {
          link_id,
          transactions: transactionsToImport,
        },
        progress: { processed: 0, total: transactionsToImport.length },
      })) as { error: { message: string } | null };

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    const queue = getJobQueue();
    await queue.add('job', { jobId });

    return NextResponse.json({ success: true, job_id: jobId });
  } catch (error: any) {
    console.error('Error in POST /api/pluggy/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
