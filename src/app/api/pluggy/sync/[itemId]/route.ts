import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { syncItem } from '@/services/pluggy/syncItem';
import { createErrorResponse } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = params;

    const result = await syncItem(userId, itemId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Sync failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


