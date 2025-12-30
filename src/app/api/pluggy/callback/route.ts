import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { processWebhook } from '@/services/pluggy/webhook';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Process webhook event
    await processWebhook(userId, body);

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


