import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { getOrGenerateDailyTip, getRecentTips } from '@/services/advisor';
import { createErrorResponse } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/advisor/tips
 * Get the daily tip for the authenticated user
 * Returns cached tip if available, generates new one if not
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ownerId = await getEffectiveOwnerId(request, userId);

    // Check for recent tips query param
    const { searchParams } = new URL(request.url);
    const recent = searchParams.get('recent');

    if (recent) {
      // Return recent tips history
      const limit = parseInt(recent) || 7;
      const tips = await getRecentTips(ownerId, Math.min(limit, 30));
      return NextResponse.json({ tips });
    }

    // Get or generate daily tip
    const result = await getOrGenerateDailyTip(ownerId);

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
