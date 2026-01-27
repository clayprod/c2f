import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

/**
 * Endpoint para corrigir ícones inválidos de categorias
 * Atualiza bx-cart (que não existe) para bx-shopping-bag
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { supabase } = createClientFromRequest(request);

    // Buscar todas as categorias com bx-cart
    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, icon')
      .eq('user_id', ownerId)
      .eq('icon', 'bx-cart');

    if (fetchError) throw fetchError;

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma categoria com ícone inválido encontrada',
        updated: 0,
      });
    }

    // Atualizar todas as categorias encontradas
    const { data: updated, error: updateError } = await supabase
      .from('categories')
      .update({ icon: 'bx-shopping-bag' })
      .eq('user_id', ownerId)
      .eq('icon', 'bx-cart')
      .select('id, name, icon');

    if (updateError) throw updateError;

    return NextResponse.json({
      message: `${updated?.length || 0} categoria(s) atualizada(s) com sucesso`,
      updated: updated?.length || 0,
      categories: updated,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}



