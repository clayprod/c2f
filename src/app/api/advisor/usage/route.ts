import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserPlanAdmin } from '@/services/stripe/subscription';
import { createErrorResponse } from '@/lib/errors';
import { getPlanFeatures } from '@/services/admin/globalSettings';
import { resolvePlanLimit } from '@/lib/planFeatures';

async function countMonthlyAdvisorChats(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  firstDayOfMonth: string
): Promise<number> {
  const baseQuery = () => admin
    .from('advisor_insights')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .gte('created_at', firstDayOfMonth);

  const byInsightType = await baseQuery().eq('insight_type', 'chat');
  if (!byInsightType.error) {
    return byInsightType.count ?? 0;
  }

  if (byInsightType.error.code !== '42703' && !byInsightType.error.message?.includes('insight_type')) {
    console.error('Error counting advisor chats:', byInsightType.error);
    return byInsightType.count ?? 0;
  }

  const byMetadata = await baseQuery().not('metadata', 'is', null);
  if (!byMetadata.error) {
    return byMetadata.count ?? 0;
  }

  if (byMetadata.error.code !== '42703' && !byMetadata.error.message?.includes('metadata')) {
    console.error('Error counting advisor chats:', byMetadata.error);
    return byMetadata.count ?? 0;
  }

  const fallback = await baseQuery();
  if (fallback.error) {
    console.error('Error counting advisor chats:', fallback.error);
  }
  return fallback.count ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);
    const admin = createAdminClient();

    const userPlan = await getUserPlanAdmin(ownerId);
    const planFeatures = await getPlanFeatures(userPlan.plan);
    const aiFeature = planFeatures?.ai_advisor;
    const fallbackEnabled = userPlan.plan !== 'free';

    if (aiFeature?.enabled === false || (!aiFeature && !fallbackEnabled)) {
      return NextResponse.json(
        { error: 'Acesso ao AI Advisor não está habilitado no seu plano atual.' },
        { status: 403 }
      );
    }

    const { getGlobalSettings } = await import('@/services/admin/globalSettings');
    const settings = await getGlobalSettings();

    const defaultLimit = userPlan.plan === 'pro'
      ? (settings.advisor_limit_pro ?? 10)
      : (settings.advisor_limit_premium ?? 100);

    const resolvedLimit = aiFeature
      ? resolvePlanLimit(aiFeature, defaultLimit)
      : { enabled: true, unlimited: false, limit: defaultLimit };
    const { limit: monthlyLimit, unlimited } = resolvedLimit;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const used = await countMonthlyAdvisorChats(admin, ownerId, firstDayOfMonth);

    return NextResponse.json({
      used,
      limit: monthlyLimit,
      unlimited,
    });
  } catch (error) {
    console.error('Advisor usage API error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
