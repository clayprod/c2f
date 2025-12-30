import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeClient;
}

// Plan price IDs (from environment variables)
export const PLAN_PRICE_IDS = {
  FREE: null, // Free plan has no price
  PRO: process.env.STRIPE_PRICE_ID_PRO || '',
  BUSINESS: process.env.STRIPE_PRICE_ID_BUSINESS || '',
} as const;

export type PlanId = keyof typeof PLAN_PRICE_IDS;

