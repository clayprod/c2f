import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

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

    // Count transactions to migrate
    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', params.id)
      .eq('user_id', ownerId);

    if (!transactionCount || transactionCount === 0) {
      return NextResponse.json(
        { error: 'A categoria origem não possui transações para migrar' },
        { status: 400 }
      );
    }

    // Migrate all transactions atomically
    const { data: migratedTransactions, error: migrateError } = await supabase
      .from('transactions')
      .update({ category_id: target_category_id })
      .eq('category_id', params.id)
      .eq('user_id', ownerId)
      .select('id');

    if (migrateError) {
      throw migrateError;
    }

    const migratedCount = migratedTransactions?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Migração concluída com sucesso`,
      data: {
        sourceCategory: {
          id: sourceCategory.id,
          name: sourceCategory.name,
        },
        targetCategory: {
          id: targetCategory.id,
          name: targetCategory.name,
        },
        transactionsMigrated: migratedCount,
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

