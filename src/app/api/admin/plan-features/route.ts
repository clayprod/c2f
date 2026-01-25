import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getAllPlanFeatures,
  getPlanDisplayConfig,
  updatePlanFeatures,
  updatePlanDisplayConfig,
  clearSettingsCache,
} from '@/services/admin/globalSettings';
import { clearPricingCache } from '@/services/pricing/cache';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [features, displayConfig] = await Promise.all([
      getAllPlanFeatures(),
      getPlanDisplayConfig(),
    ]);

    return NextResponse.json({
      plan_features_free: features.free,
      plan_features_pro: features.pro,
      plan_features_premium: features.premium,
      plan_display_config: displayConfig,
    });
  } catch (error: any) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const {
      plan_features_free,
      plan_features_pro,
      plan_features_premium,
      plan_display_config,
    } = body;

    console.log('[PlanFeatures API] Updating with:', JSON.stringify({
      has_free: !!plan_features_free,
      has_pro: !!plan_features_pro,
      has_premium: !!plan_features_premium,
      display_config: plan_display_config,
    }, null, 2));

    // Update plan features
    if (plan_features_free) {
      console.log('[PlanFeatures API] Updating free features...');
      await updatePlanFeatures('free', plan_features_free);
    }
    if (plan_features_pro) {
      console.log('[PlanFeatures API] Updating pro features...');
      await updatePlanFeatures('pro', plan_features_pro);
    }
    if (plan_features_premium) {
      console.log('[PlanFeatures API] Updating premium features...');
      await updatePlanFeatures('premium', plan_features_premium);
    }

    // Update display config
    if (plan_display_config) {
      console.log('[PlanFeatures API] Updating display config...');
      await updatePlanDisplayConfig(plan_display_config);
    }

    // Clear cache
    clearSettingsCache();
    clearPricingCache();

    console.log('[PlanFeatures API] Update complete');
    return NextResponse.json({
      success: true,
      message: 'Plan features updated successfully',
    });
  } catch (error: any) {
    console.error('[PlanFeatures API] Error:', error);
    console.error('[PlanFeatures API] Error message:', error.message);
    console.error('[PlanFeatures API] Error stack:', error.stack);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
