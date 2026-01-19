import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { cancelSubscription } from '@/services/stripe/subscription';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await cancelSubscription(userId);

    return NextResponse.json({ 
      success: true,
      message: 'Assinatura cancelada com sucesso. Você continuará com acesso até o fim do período atual.' 
    });
  } catch (error: any) {
    console.error('[Billing] Cancel subscription error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
