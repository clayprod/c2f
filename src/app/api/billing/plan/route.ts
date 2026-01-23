import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { getUserPlanAdmin } from '@/services/stripe/subscription';
import { resolvePlanLimit } from '@/lib/planFeatures';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await getEffectiveOwnerId(request, userId);
    const plan = await getUserPlanAdmin(ownerId);

    // Get limits from global settings
    const { getGlobalSettings } = await import('@/services/admin/globalSettings');
    const settings = await getGlobalSettings();

    // Get plan features from settings
    const { getPlanFeatures } = await import('@/services/admin/globalSettings');
    const planFeaturesConfig = {
      free: await getPlanFeatures('free'),
      pro: await getPlanFeatures('pro'),
      premium: await getPlanFeatures('premium'),
    };

    // Define limits based on plan
    const normalizeLimit = (feature: any, fallback: number) =>
      feature ? resolvePlanLimit(feature, fallback) : { enabled: true, unlimited: fallback === -1, limit: fallback };

    const freeTransactions = normalizeLimit(planFeaturesConfig.free?.transactions, 100);
    const proTransactions = normalizeLimit(planFeaturesConfig.pro?.transactions, -1);
    const premiumTransactions = normalizeLimit(planFeaturesConfig.premium?.transactions, -1);

    const freeAdvisor = normalizeLimit(planFeaturesConfig.free?.ai_advisor, 0);
    const proAdvisor = normalizeLimit(planFeaturesConfig.pro?.ai_advisor, settings.advisor_limit_pro ?? 10);
    const premiumAdvisor = normalizeLimit(planFeaturesConfig.premium?.ai_advisor, settings.advisor_limit_premium ?? 100);

    const limits = {
      free: {
        transactions_per_month: freeTransactions.unlimited ? -1 : freeTransactions.limit,
        advisor_queries_per_month: freeAdvisor.unlimited ? -1 : freeAdvisor.limit,
        accounts: 5,
        categories: 20,
        budgets: 0,
        pluggy_integration: false,
        whatsapp_integration: planFeaturesConfig.free?.integrations?.enabled ?? false,
        reports: planFeaturesConfig.free?.reports?.enabled ?? false,
      },
      pro: {
        transactions_per_month: proTransactions.unlimited ? -1 : proTransactions.limit,
        advisor_queries_per_month: proAdvisor.unlimited ? -1 : proAdvisor.limit,
        accounts: -1,
        categories: -1,
        budgets: -1,
        pluggy_integration: false,
        whatsapp_integration: planFeaturesConfig.pro?.integrations?.enabled ?? true,
        reports: planFeaturesConfig.pro?.reports?.enabled ?? false,
      },
      premium: {
        transactions_per_month: premiumTransactions.unlimited ? -1 : premiumTransactions.limit,
        advisor_queries_per_month: premiumAdvisor.unlimited ? -1 : premiumAdvisor.limit,
        accounts: -1,
        categories: -1,
        budgets: -1,
        pluggy_integration: true,
        whatsapp_integration: planFeaturesConfig.premium?.integrations?.enabled ?? true,
        reports: planFeaturesConfig.premium?.reports?.enabled ?? true,
      },
    };

    return NextResponse.json({
      plan: plan.plan,
      status: plan.status,
      current_period_end: plan.current_period_end,
      limits: limits[plan.plan],
      features: planFeaturesConfig[plan.plan] || {},
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}




