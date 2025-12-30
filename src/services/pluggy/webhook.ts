import { createClient } from '@/lib/supabase/server';
import { syncItem } from './syncItem';

export interface PluggyWebhookEvent {
  type: string;
  item: {
    id: string;
    connector: {
      id: number;
      name: string;
    };
    status: string;
    executionStatus: string;
    error?: {
      code: string;
      message: string;
    };
  };
}

export async function processWebhook(
  userId: string,
  event: PluggyWebhookEvent
): Promise<void> {
  const supabase = await createClient();
  const item = event.item;

  // Upsert item
  const connectorId = item.connector?.id || (item as any).connectorId;
  const connectorName = item.connector?.name || (item as any).connectorName;
  
  await supabase
    .from('pluggy_items')
    .upsert({
      user_id: userId,
      item_id: item.id,
      connector_id: connectorId?.toString(),
      connector_name: connectorName,
      status: item.status,
      execution_status: item.executionStatus || 'UPDATED',
      error_code: item.error?.code,
      error_message: item.error?.message,
    }, {
      onConflict: 'item_id',
    });

  // If item is successfully updated and execution status is SUCCESS, trigger sync
  if (event.type === 'ITEM_UPDATED' && (item.executionStatus === 'SUCCESS' || !item.executionStatus)) {
    await syncItem(userId, item.id);
  }
}

