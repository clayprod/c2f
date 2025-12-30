import { NextRequest, NextResponse } from 'next/server';
import { getUserId, getUser } from '@/lib/auth';
import { createCheckoutSession } from '@/services/stripe/subscription';
import { PLAN_PRICE_IDS } from '@/services/stripe/client';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'business']),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = checkoutSchema.parse(body);

    const priceId = validated.plan === 'pro' ? PLAN_PRICE_IDS.PRO : PLAN_PRICE_IDS.BUSINESS;
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const sessionUrl = await createCheckoutSession(
      userId,
      priceId,
      `${origin}/app?checkout=success`,
      `${origin}/pricing?checkout=cancelled`
    );

    return NextResponse.json({ url: sessionUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

