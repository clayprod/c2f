import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Get all user categories
    const { data: allCategories, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        type,
        icon,
        color,
        is_active,
        created_at,
        updated_at
      `)
      .eq('user_id', userId);

    if (categoriesError) throw categoriesError;

    // Count transactions for each category and filter those with transactions
    const categoriesWithCounts = await Promise.all(
      (allCategories || []).map(async (category) => {
        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('user_id', userId);

        return {
          ...category,
          transaction_count: count || 0,
        };
      })
    );

    // Filter out categories with 0 transactions
    const filtered = categoriesWithCounts.filter(cat => cat.transaction_count > 0);

    return NextResponse.json({ 
      data: filtered.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

