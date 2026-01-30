import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getAdminClient } from '@/lib/supabase/admin';
import { getJobQueue } from '@/lib/queue/jobQueue';

interface StartImportBody {
  ofx_content: string;
  account_id?: string;
  categories?: Record<string, string>;
  selected_ids?: string[];
  original_filename?: string;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as StartImportBody;
    const { ofx_content, account_id, categories, selected_ids, original_filename } = body;

    if (!ofx_content) {
      return NextResponse.json({ error: 'OFX content is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'imports';
    const jobId = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFilename = sanitizeFilename(original_filename || 'import.ofx');
    const storagePath = `${userId}/imports/${jobId}/${timestamp}_${safeFilename}`;

    const uploadResult = await supabase.storage
      .from(bucket)
      .upload(storagePath, Buffer.from(ofx_content, 'utf-8'), {
        contentType: 'application/x-ofx',
        upsert: false,
      });

    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    const totalRows = selected_ids?.length || 0;

    const { error: jobError } = (await (supabase as any)
      .from('jobs')
      .insert({
        id: jobId,
        user_id: userId,
        type: 'ofx_import',
        status: 'queued',
        payload: {
          storage_bucket: bucket,
          storage_path: storagePath,
          original_filename: original_filename || null,
          options: {
            account_id: account_id || null,
            categories: categories || {},
            selected_ids: selected_ids || [],
          },
        },
        progress: {
          processed: 0,
          total: totalRows,
        },
      })) as { error: { message: string } | null };

    if (jobError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      return NextResponse.json({ error: jobError.message }, { status: 500 });
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
