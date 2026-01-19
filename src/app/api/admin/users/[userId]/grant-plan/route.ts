import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { grantPlan } from '@/services/admin/userPlans';
import { getUserId } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Require admin access
    const adminUser = await requireAdmin(request);
    const adminId = adminUser.id;

    const userId = params.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { plan, period_months } = body;

    // Validate inputs
    if (!plan || !['pro', 'premium'].includes(plan)) {
      return NextResponse.json(
        { error: 'Plan must be "pro" or "premium"' },
        { status: 400 }
      );
    }

    if (!period_months || typeof period_months !== 'number' || period_months < 1 || period_months > 120) {
      return NextResponse.json(
        { error: 'Period must be a number between 1 and 120 months' },
        { status: 400 }
      );
    }

    await grantPlan(userId, plan, period_months, adminId);

    return NextResponse.json({ 
      success: true,
      message: `Plano ${plan} concedido por ${period_months} meses`
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/users/[userId]/grant-plan:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { 
        error: errorResponse.error,
        details: error?.message || 'Unknown error occurred'
      },
      { status: errorResponse.statusCode }
    );
  }
}
