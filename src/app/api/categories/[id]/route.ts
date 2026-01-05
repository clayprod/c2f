import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.is_active !== undefined) {
      // If trying to deactivate, check if category has active budgets
      if (body.is_active === false) {
        const { count: budgetCount } = await supabase
          .from('budgets')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', params.id)
          .eq('user_id', userId);
        
        if (budgetCount && budgetCount > 0) {
          return NextResponse.json(
            { error: 'Não é possível inativar uma categoria que possui orçamentos associados' },
            { status: 400 }
          );
        }
      }
      updateData.is_active = body.is_active;
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', userId)
      .select()
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check if category has transactions
    const { count: transactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', params.id)
      .eq('user_id', userId);

    // Check if category has budgets
    const { count: budgetCount } = await supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', params.id)
      .eq('user_id', userId);

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
      .eq('user_id', userId);

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
