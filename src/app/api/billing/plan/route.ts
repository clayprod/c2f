import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getUserPlan } from '@/services/stripe/subscription';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plan = await getUserPlan(userId);

    // Define limits based on plan
    const limits = {
      free: {
        transactions_per_month: 100,
        advisor_queries_per_month: 3,
        accounts: 5,
        categories: 20,
        budgets: 0,
        pluggy_integration: false,
        reports: false,
      },
      pro: {
        transactions_per_month: -1, // unlimited
        advisor_queries_per_month: -1, // unlimited
        accounts: -1, // unlimited
        categories: -1, // unlimited
        budgets: -1, // unlimited
        pluggy_integration: false,
        reports: true,
      },
      business: {
        transactions_per_month: -1, // unlimited
        advisor_queries_per_month: -1, // unlimited
        accounts: -1, // unlimited
        categories: -1, // unlimited
        budgets: -1, // unlimited
        pluggy_integration: true,
        reports: true,
      },
    };

    return NextResponse.json({
      plan: plan.plan,
      status: plan.status,
      current_period_end: plan.current_period_end,
      limits: limits[plan.plan],
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}


