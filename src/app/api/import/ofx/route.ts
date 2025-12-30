import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { importOFXTransactions } from '@/services/import/importer';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ofx_content, account_id } = body;

    if (!ofx_content) {
      return NextResponse.json({ error: 'OFX content is required' }, { status: 400 });
    }

    // Import transactions
    const result = await importOFXTransactions(userId, ofx_content, account_id || undefined);

    return NextResponse.json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
