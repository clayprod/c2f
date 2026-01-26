import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { getOrGenerateDailyTip, getRecentTips } from '@/services/advisor';
import { createErrorResponse } from '@/lib/errors';
import { getUserPlanAdmin } from '@/services/stripe/subscription';

export const dynamic = 'force-dynamic';

/**
 * Lorem ipsum text for free plan users
 * Formatted to match the same structure as AI-generated tips
 */
const LOREM_IPSUM_TIP = {
  summary: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  insights: [
    {
      type: 'spending_pattern',
      message: 'Lorem ipsum dolor sit amet consectetur adipiscing elit',
      severity: 'medium' as const,
    },
    {
      type: 'budget_alert',
      message: 'Sed do eiusmod tempor incididunt ut labore et dolore',
      severity: 'low' as const,
    },
    {
      type: 'savings_opportunity',
      message: 'Ut enim ad minim veniam quis nostrud exercitation',
      severity: 'high' as const,
    },
    {
      type: 'financial_health',
      message: 'Duis aute irure dolor in reprehenderit in voluptate',
      severity: 'medium' as const,
    },
  ],
  actions: [
    {
      type: 'create_budget',
      description: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor',
      payload: {},
      confidence: 'high' as const,
    },
    {
      type: 'adjust_spending',
      description: 'Incididunt ut labore et dolore magna aliqua ut enim ad minim veniam',
      payload: {},
      confidence: 'medium' as const,
    },
    {
      type: 'create_goal',
      description: 'Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo',
      payload: {},
      confidence: 'low' as const,
    },
  ],
  confidence: 'medium' as const,
  citations: [],
};

/**
 * GET /api/advisor/tips
 * Get the daily tip for the authenticated user
 * Returns cached tip if available, generates new one if not
 * For free plan users, returns lorem ipsum to avoid AI token costs
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

    // Check user plan - free plan users get lorem ipsum instead of AI-generated tips
    const userPlan = await getUserPlanAdmin(ownerId);
    if (userPlan.plan === 'free') {
      return NextResponse.json({
        ...LOREM_IPSUM_TIP,
        isNew: false,
        cached: false,
      });
    }

    // Get or generate daily tip for paid plans
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
