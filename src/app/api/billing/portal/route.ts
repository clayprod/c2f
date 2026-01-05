import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createPortalSession } from '@/services/stripe/subscription';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const sessionUrl = await createPortalSession(
      userId,
      `${origin}/app?portal=success`
    );

    return NextResponse.json({ url: sessionUrl });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}





