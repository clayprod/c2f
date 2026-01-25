import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId, isAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { getItem } from '@/services/pluggy/items';
import { syncItem } from '@/services/pluggy/syncItem';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (Pluggy/OpenFinance is admin-only)
    const admin = await isAdmin(userId, request);
    if (!admin) {
      return NextResponse.json(
        { error: 'A integração Open Finance está disponível apenas para administradores' },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('pluggy_items')
      .select('*, pluggy_sync_logs(status, finished_at, accounts_synced, transactions_synced)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('finished_at', { referencedTable: 'pluggy_sync_logs', ascending: false });

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

// POST - Register a new item after successful connection via Pluggy Connect Widget
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (Pluggy/OpenFinance is admin-only)
    const admin = await isAdmin(userId, request);
    if (!admin) {
      return NextResponse.json(
        { error: 'A integração Open Finance está disponível apenas para administradores' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Fetch item details from Pluggy API
    const item = await getItem(itemId);

    const supabase = await createClient();

    // Upsert the item in our database
    const connectorId = item.connector?.id || item.connectorId;
    const connectorName = item.connector?.name || item.connectorName;

    const { data, error } = await supabase
      .from('pluggy_items')
      .upsert({
        user_id: userId,
        item_id: itemId,
        connector_id: connectorId?.toString(),
        connector_name: connectorName,
        status: item.status,
        execution_status: item.executionStatus || 'SUCCESS',
        error_code: item.error?.code,
        error_message: item.error?.message,
      }, {
        onConflict: 'item_id',
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger initial sync if item is ready
    if (item.executionStatus === 'SUCCESS' || !item.executionStatus) {
      // Run sync in background (don't await to avoid timeout)
      syncItem(userId, itemId).catch(err => {
        console.error('[Pluggy] Background sync error:', err);
      });
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Item registered successfully. Sync started in background.'
    });
  } catch (error) {
    console.error('[Pluggy] Error registering item:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
