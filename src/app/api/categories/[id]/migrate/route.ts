import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { getJobQueue } from '@/lib/queue/jobQueue';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const body = await request.json();
    const { target_category_id } = body;

    if (!target_category_id) {
      return NextResponse.json(
        { error: 'target_category_id é obrigatório' },
        { status: 400 }
      );
    }

    if (params.id === target_category_id) {
      return NextResponse.json(
        { error: 'A categoria origem e destino não podem ser a mesma' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    // Verify source category exists and belongs to user
    const { data: sourceCategory, error: sourceError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (sourceError || !sourceCategory) {
      return NextResponse.json(
        { error: 'Categoria origem não encontrada' },
        { status: 404 }
      );
    }

    // Verify target category exists, belongs to user, and is active
    const { data: targetCategory, error: targetError } = await supabase
      .from('categories')
      .select('id, name, is_active')
      .eq('id', target_category_id)
      .eq('user_id', ownerId)
      .single();

    if (targetError || !targetCategory) {
      return NextResponse.json(
        { error: 'Categoria destino não encontrada' },
        { status: 404 }
      );
    }

    if (!targetCategory.is_active) {
      return NextResponse.json(
        { error: 'A categoria destino deve estar ativa' },
        { status: 400 }
      );
    }

    const jobId = randomUUID();
    const { error: jobError } = (await (supabase as any)
      .from('jobs')
      .insert({
        id: jobId,
        user_id: ownerId,
        type: 'category_migration',
        status: 'queued',
        payload: {
          source_category_id: params.id,
          target_category_id,
          user_id: ownerId,
        },
        progress: { processed: 0, total: 0 },
      })) as { error: { message: string } | null };

    if (jobError) {
      throw new Error(jobError.message);
    }

    const queue = getJobQueue();
    await queue.add('job', { jobId });

    return NextResponse.json({
      success: true,
      message: 'Migração iniciada',
      data: {
        job_id: jobId,
        sourceCategory: {
          id: sourceCategory.id,
          name: sourceCategory.name,
        },
        targetCategory: {
          id: targetCategory.id,
          name: targetCategory.name,
        },
      },
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

