import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { deleteItem } from '@/services/pluggy/items';
import { createErrorResponse } from '@/lib/errors';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = params;

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

    // Delete from Pluggy
    await deleteItem(itemId);

    // Delete from database (cascade will handle related records)
    await supabase
      .from('pluggy_items')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

