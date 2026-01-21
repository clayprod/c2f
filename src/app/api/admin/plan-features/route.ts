import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getAllPlanFeatures,
  getPlanDisplayConfig,
  updatePlanFeatures,
  updatePlanDisplayConfig,
  clearSettingsCache,
} from '@/services/admin/globalSettings';
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

    // Update plan features
    if (plan_features_free) {
      await updatePlanFeatures('free', plan_features_free);
    }
    if (plan_features_pro) {
      await updatePlanFeatures('pro', plan_features_pro);
    }
    if (plan_features_premium) {
      await updatePlanFeatures('premium', plan_features_premium);
    }

    // Update display config
    if (plan_display_config) {
      await updatePlanDisplayConfig(plan_display_config);
    }

    // Clear cache
    clearSettingsCache();

    return NextResponse.json({
      success: true,
      message: 'Plan features updated successfully',
    });
  } catch (error: any) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
