import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGlobalSettings } from '@/services/admin/globalSettings';

function getApiKey(request: NextRequest) {
  return request.headers.get('x-n8n-api-key') || request.headers.get('X-N8N-API-KEY');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const settings = await getGlobalSettings();
    if (!settings.n8n_api_key) {
      return NextResponse.json({ error: 'n8n api key não configurada' }, { status: 500 });
    }

    const apiKey = getApiKey(request);
    if (!apiKey || apiKey !== settings.n8n_api_key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'job_id é obrigatório' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from('jobs')
      .select('id, type, status, payload, progress, error_summary, created_at, updated_at')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        error_summary: job.error_summary,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    });
  } catch (error) {
    console.error('[n8n/jobs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
