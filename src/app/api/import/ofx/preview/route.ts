import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { parseOFX } from '@/services/import/ofxParser';
import { createErrorResponse } from '@/lib/errors';

/**
 * Preview OFX transactions without importing
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ofx_content } = body;

    if (!ofx_content) {
      return NextResponse.json({ error: 'OFX content is required' }, { status: 400 });
    }

    // Parse OFX file
    const ofxData = parseOFX(ofx_content);
    if (!ofxData) {
      return NextResponse.json(
        { error: 'Não foi possível processar o arquivo OFX. Verifique o formato.' },
        { status: 400 }
      );
    }

    // Convert to preview format
    const transactions = ofxData.transactions.map((tx, index) => ({
      id: tx.fitId || `ofx-${index}`,
      date: tx.date,
      description: tx.description,
      amount: tx.amount, // Already signed from OFX
    }));

    return NextResponse.json({
      transactions,
      account: ofxData.account,
      balance: ofxData.balance,
      balanceDate: ofxData.balanceDate,
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
