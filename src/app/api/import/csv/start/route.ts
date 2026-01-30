import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getAdminClient } from '@/lib/supabase/admin';
import { getImportQueue } from '@/lib/queue/importQueue';

interface StartImportBody {
  csv_content: string;
  account_id?: string;
  categories?: Record<string, string>;
  categories_to_create?: Array<{ name: string; type: 'income' | 'expense' }>;
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
    const { csv_content, account_id, categories, categories_to_create, selected_ids, original_filename } = body;

    if (!csv_content) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'imports';
    const jobId = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFilename = sanitizeFilename(original_filename || 'import.csv');
    const storagePath = `${userId}/imports/${jobId}/${timestamp}_${safeFilename}`;

    // Clean up previous completed files with same filename (best-effort)
    if (original_filename) {
      const { data: previousJobs } = (await supabase
        .from('import_jobs')
        .select('id, storage_path')
        .eq('user_id', userId)
        .eq('original_filename', original_filename)
        .in('status', ['completed', 'failed', 'cancelled'])) as {
        data: Array<{ id: string; storage_path: string }> | null;
      };

      if (previousJobs && previousJobs.length > 0) {
        const oldPaths = previousJobs.map(job => job.storage_path);
        await supabase.storage.from(bucket).remove(oldPaths);
        await supabase.from('import_jobs').delete().in('id', previousJobs.map(job => job.id));
      }
    }

    const uploadResult = await supabase.storage
      .from(bucket)
      .upload(storagePath, Buffer.from(csv_content, 'utf-8'), {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    const totalRows = selected_ids?.length || 0;

    const { error: jobError } = (await (supabase as any)
      .from('import_jobs')
      .insert({
        id: jobId,
        user_id: userId,
        status: 'queued',
        storage_bucket: bucket,
        storage_path: storagePath,
        original_filename: original_filename || null,
        options: {
          account_id: account_id || null,
          categories: categories || {},
          categories_to_create: categories_to_create || [],
          selected_ids: selected_ids || [],
        },
        total_rows: totalRows,
      })) as { error: { message: string } | null };

    if (jobError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    const queue = getImportQueue();
    await queue.add('csv-import', { jobId });

    return NextResponse.json({ job_id: jobId });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
