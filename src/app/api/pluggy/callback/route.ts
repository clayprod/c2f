import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processWebhook } from '@/services/pluggy/webhook';
import { createErrorResponse } from '@/lib/errors';

// Webhook endpoint for Pluggy - does NOT require user authentication
// since it's called by Pluggy's servers, not the user's browser
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[Pluggy Webhook] Received event:', body.type, 'for item:', body.item?.id);

    // Webhooks from Pluggy don't have user authentication
    // We need to look up the user_id from our database using the item_id
    const itemId = body.item?.id;
    
    if (!itemId) {
      console.warn('[Pluggy Webhook] No item_id in webhook payload');
      return NextResponse.json({ received: true, warning: 'No item_id in payload' });
    }

    const supabase = await createClient();
    
    // Look up the user_id from the existing pluggy_item
    const { data: existingItem } = await supabase
      .from('pluggy_items')
      .select('user_id')
      .eq('item_id', itemId)
      .single();

    if (!existingItem) {
      // Item not registered yet - this can happen if the widget onSuccess
      // hasn't completed yet. Log and return success to avoid Pluggy retries.
      console.log('[Pluggy Webhook] Item not found in database yet, skipping:', itemId);
      return NextResponse.json({ 
        received: true, 
        warning: 'Item not registered yet, will be handled by widget onSuccess' 
      });
    }

    // Process webhook event with the found user_id
    await processWebhook(existingItem.user_id, body);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Pluggy Webhook] Error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}






