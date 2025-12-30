import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = params;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify ownership
    const supabase = await createClient();
    const { data: item } = await supabase
      .from('pluggy_items')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('pluggy_transactions')
      .select('*, pluggy_accounts(*)')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

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

