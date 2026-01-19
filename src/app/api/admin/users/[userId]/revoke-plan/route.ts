import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { revokePlan } from '@/services/admin/userPlans';

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
    const { cancel_stripe_subscription = false } = body;

    await revokePlan(userId, cancel_stripe_subscription, adminId);

    return NextResponse.json({ 
      success: true,
      message: 'Plano revogado com sucesso'
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
