import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    const { supabase } = createClientFromRequest(request);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PATCH(
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
    const { supabase } = createClientFromRequest(request);

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    // Only include expense_type if it's explicitly provided (including null)
    // and the category type is 'expense' or not specified
    if (body.expense_type !== undefined) {
      // Validate that expense_type is either 'fixed', 'variable', or null
      if (body.expense_type === null || body.expense_type === 'fixed' || body.expense_type === 'variable') {
        updateData.expense_type = body.expense_type;
      } else {
        return NextResponse.json(
          { error: 'Tipo de despesa inválido. Use "fixed", "variable" ou null' },
          { status: 400 }
        );
      }
    }
    if (body.is_active !== undefined) {
      // If trying to deactivate, check if category has active budgets
      if (body.is_active === false) {
        const { count: budgetCount } = await supabase
          .from('budgets')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', params.id)
          .eq('user_id', ownerId);
        
        if (budgetCount && budgetCount > 0) {
          return NextResponse.json(
            { error: 'Não é possível inativar uma categoria que possui orçamentos associados' },
            { status: 400 }
          );
        }
      }
      updateData.is_active = body.is_active;
    }

    console.log('[PATCH /api/categories/:id] Update data:', updateData);
    
    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/categories/:id] Supabase error:', error);
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[PATCH /api/categories/:id] Error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: errorResponse.statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);
    const { supabase } = createClientFromRequest(request);

    // Check if category has transactions
    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', params.id)
      .eq('user_id', ownerId);

    // Check if category has budgets
    const { count: budgetCount } = await supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', params.id)
      .eq('user_id', ownerId);

    if (transactionCount && transactionCount > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível excluir uma categoria que possui transações',
          details: { transactionCount, budgetCount: budgetCount || 0 }
        },
        { status: 400 }
      );
    }

    if (budgetCount && budgetCount > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível excluir uma categoria que possui orçamentos associados',
          details: { transactionCount: transactionCount || 0, budgetCount }
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', params.id)
      .eq('user_id', ownerId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
