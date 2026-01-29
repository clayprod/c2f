import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponseNext } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { projectionCache } from '@/services/projections/cache';

interface DependencyCheck {
  table: string;
  name: string;
  field: string;
}

const DEPENDENCY_CHECKS: DependencyCheck[] = [
  { table: 'credit_cards', name: 'Cartões de Crédito', field: 'category_id' },
  { table: 'goals', name: 'Objetivos', field: 'category_id' },
  { table: 'debts', name: 'Dívidas', field: 'category_id' },
  { table: 'investments', name: 'Investimentos', field: 'category_id' },
  { table: 'transactions', name: 'Transações', field: 'category_id' },
  { table: 'budgets', name: 'Orçamentos', field: 'category_id' },
];

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    // Buscar todas as categorias do usuário
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', ownerId);

    if (categoriesError) {
      throw categoriesError;
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma categoria encontrada para remover',
        deleted: 0,
      });
    }

    const categoryIds = categories.map(c => c.id);
    const blockingDependencies: { name: string; count: number }[] = [];

    // Verificar dependências para cada categoria
    for (const check of DEPENDENCY_CHECKS) {
      const { count, error: countError } = await supabase
        .from(check.table)
        .select('*', { count: 'exact', head: true })
        .in(check.field, categoryIds);

      if (countError) {
        console.warn(`[DELETE /api/categories/bulk] Error checking ${check.table}:`, countError);
        continue;
      }

      if (count && count > 0) {
        blockingDependencies.push({
          name: check.name,
          count,
        });
      }
    }

    // Se há dependências bloqueantes, retornar erro com detalhes
    if (blockingDependencies.length > 0) {
      const dependencyList = blockingDependencies
        .map(d => `${d.name} (${d.count})`)
        .join(', ');

      return NextResponse.json({
        error: 'Não é possível remover as categorias',
        message: `Existem entidades vinculadas às categorias. Remova-as primeiro: ${dependencyList}`,
        dependencies: blockingDependencies,
        code: 'DEPENDENCIES_EXIST',
      }, { status: 409 });
    }

    // Remover todas as categorias
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', ownerId);

    if (deleteError) {
      throw deleteError;
    }

    // Invalidar cache de projeções
    projectionCache.invalidateUser(ownerId);

    return NextResponse.json({
      message: `${categories.length} categorias removidas com sucesso`,
      deleted: categories.length,
    });
  } catch (error: any) {
    console.error('[DELETE /api/categories/bulk] Error:', error);
    return createErrorResponseNext(error);
  }
}
