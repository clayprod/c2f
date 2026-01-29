import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponseNext } from '@/lib/errors';

const BATCH_SIZE = 100; // Deletar 100 transações por vez

// GET - Verificar dependências antes de deletar
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Buscar contagem total de transações do usuário logado
    const { count: transactionCount, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('[GET /api/transactions/bulk] Count error:', countError);
      throw countError;
    }

    console.log('[GET /api/transactions/bulk] transactionCount:', transactionCount);

    if (!transactionCount || transactionCount === 0) {
      return NextResponse.json({ transactions: 0, dependencies: [], canDelete: false });
    }

    return NextResponse.json({
      transactions: transactionCount,
      dependencies: [],
      canDelete: true,
    });
  } catch (error: any) {
    console.error('[GET /api/transactions/bulk] Error:', error);
    return createErrorResponseNext(error);
  }
}

// DELETE - Remover todas as transações em lotes
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[DELETE /api/transactions/bulk] userId:', userId);

    const { supabase } = createClientFromRequest(request);

    // Buscar contagem inicial
    const { count: initialCount, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('[DELETE /api/transactions/bulk] Count error:', countError);
      throw countError;
    }

    console.log('[DELETE /api/transactions/bulk] initialCount:', initialCount);

    if (!initialCount || initialCount === 0) {
      return NextResponse.json({ message: 'Nenhuma transação encontrada', deleted: 0 });
    }

    let totalDeleted = 0;
    let hasMore = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Limite de segurança

    // Deletar em lotes até não haver mais transações
    while (hasMore && iterations < MAX_ITERATIONS) {
      iterations++;
      
      // 1. Buscar IDs das transações do usuário (apenas parcelas filhas primeiro)
      const { data: childTransactions, error: childFetchError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .not('installment_parent_id', 'is', null)
        .limit(BATCH_SIZE);

      if (childFetchError) {
        console.error('[DELETE /api/transactions/bulk] Error fetching child transactions:', childFetchError);
        break;
      }

      // Deletar parcelas filhas
      if (childTransactions && childTransactions.length > 0) {
        const childIds = childTransactions.map(t => t.id);
        const { error: childDeleteError } = await supabase
          .from('transactions')
          .delete()
          .in('id', childIds);

        if (childDeleteError) {
          console.error('[DELETE /api/transactions/bulk] Error deleting child transactions:', childDeleteError);
          break;
        }

        totalDeleted += childIds.length;
        console.log(`[DELETE /api/transactions/bulk] Deleted ${childIds.length} child transactions`);
        
        // Continuar para o próximo lote
        continue;
      }

      // 2. Se não há mais parcelas filhas, buscar transações principais
      const { data: mainTransactions, error: mainFetchError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .is('installment_parent_id', null)
        .limit(BATCH_SIZE);

      if (mainFetchError) {
        console.error('[DELETE /api/transactions/bulk] Error fetching main transactions:', mainFetchError);
        break;
      }

      // Deletar transações principais
      if (mainTransactions && mainTransactions.length > 0) {
        const mainIds = mainTransactions.map(t => t.id);
        const { error: mainDeleteError } = await supabase
          .from('transactions')
          .delete()
          .in('id', mainIds);

        if (mainDeleteError) {
          console.error('[DELETE /api/transactions/bulk] Error deleting main transactions:', mainDeleteError);
          break;
        }

        totalDeleted += mainIds.length;
        console.log(`[DELETE /api/transactions/bulk] Deleted ${mainIds.length} main transactions`);
        
        // Se deletamos menos que o batch size, provavelmente não há mais
        if (mainIds.length < BATCH_SIZE) {
          hasMore = false;
        }
      } else {
        // Não há mais transações
        hasMore = false;
      }
    }

    console.log(`[DELETE /api/transactions/bulk] Success! Total deleted: ${totalDeleted}`);

    return NextResponse.json({
      message: `${totalDeleted} transações removidas com sucesso`,
      deleted: totalDeleted,
    });
  } catch (error: any) {
    console.error('[DELETE /api/transactions/bulk] Error:', error);
    return createErrorResponseNext(error);
  }
}
