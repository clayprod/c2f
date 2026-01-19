import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { getUserPlan } from '@/services/stripe/subscription';
import { createConnectToken } from '@/services/pluggy/items';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has paid plan (Premium plan required for Pluggy)
    const plan = await getUserPlan(userId);
    if (plan.plan !== 'premium') {
      return NextResponse.json(
        { error: 'Pluggy integration requires Premium plan' },
        { status: 403 }
      );
    }

    const connectToken = await createConnectToken();

    return NextResponse.json({ connectToken });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}






