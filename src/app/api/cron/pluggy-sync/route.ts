import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncItem } from '@/services/pluggy/syncItem';

export const dynamic = 'force-dynamic';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

const BLOCKED_STATUSES = new Set(['LOGIN_ERROR', 'WAITING_USER_INPUT']);

export async function GET(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: items, error } = await supabase
      .from('pluggy_items')
      .select('user_id, item_id, execution_status, status');

    if (error) {
      console.error('[Pluggy Cron] Error fetching items:', error);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, message: 'No items to sync', total: 0 });
    }

    const eligibleItems = items.filter((item) => {
      const status = item.execution_status || item.status;
      return !status || !BLOCKED_STATUSES.has(status);
    });

    const results = {
      total: eligibleItems.length,
      processed: 0,
      synced: 0,
      failed: 0,
      skipped: items.length - eligibleItems.length,
    };

    const batchSize = 5;
    for (let i = 0; i < eligibleItems.length; i += batchSize) {
      const batch = eligibleItems.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (item) => {
          results.processed++;
          try {
            const result = await syncItem(item.user_id, item.item_id, { supabase });
            if (result.success) {
              results.synced++;
            } else {
              results.failed++;
            }
          } catch (syncError) {
            console.error('[Pluggy Cron] Error syncing item:', item.item_id, syncError);
            results.failed++;
          }
        })
      );

      if (i + batchSize < eligibleItems.length) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('[Pluggy Cron] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
