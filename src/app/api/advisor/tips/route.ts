import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getOrGenerateDailyTip, getRecentTips } from '@/services/advisor';
import { createErrorResponse } from '@/lib/errors';

/**
 * GET /api/advisor/tips
 * Get the daily tip for the authenticated user
 * Returns cached tip if available, generates new one if not
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for recent tips query param
    const { searchParams } = new URL(request.url);
    const recent = searchParams.get('recent');

    if (recent) {
      // Return recent tips history
      const limit = parseInt(recent) || 7;
      const tips = await getRecentTips(userId, Math.min(limit, 30));
      return NextResponse.json({ tips });
    }

    // Get or generate daily tip
    const result = await getOrGenerateDailyTip(userId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 503 }
      );
    }

    if (!result.tip) {
      return NextResponse.json(
        { error: 'Não foi possível gerar a dica do dia' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...result.tip,
      isNew: result.isNew,
      cached: result.cached,
    });
  } catch (error) {
    console.error('Tips API error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
