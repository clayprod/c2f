import { getStripeClient } from './client';
import { createClient } from '@/lib/supabase/server';
import { PLAN_PRICE_IDS } from './client';
import { getOrCreateStripeCustomer } from './customer';

export async function getUserPlan(userId: string): Promise<{
  plan: 'free' | 'pro' | 'business';
  status: string;
  current_period_end: Date | null;
}> {
  const supabase = await createClient();
  
  const { data: subscription } = await supabase
    .from('billing_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!subscription || subscription.status !== 'active') {
    return {
      plan: 'free',
      status: 'active',
      current_period_end: null,
    };
  }

  return {
    plan: subscription.plan_id as 'free' | 'pro' | 'business',
    status: subscription.status,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
  };
}

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  console.log('[Stripe] Creating checkout session for user:', userId);
  console.log('[Stripe] Price ID:', priceId);

  const stripe = getStripeClient();
  const supabase = await createClient();

  // Get user email
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[Stripe] User email:', user?.email || 'NOT FOUND');

  if (!user?.email) {
    throw new Error('User email not found');
  }

  console.log('[Stripe] Getting or creating Stripe customer...');
  const customerId = await getOrCreateStripeCustomer(userId, user.email);
  console.log('[Stripe] Customer ID:', customerId);

  console.log('[Stripe] Creating checkout session...');
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
    },
  });

  console.log('[Stripe] Checkout session created:', session.id);
  console.log('[Stripe] Checkout URL:', session.url);

  return session.url || '';
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripeClient();
  const supabase = await createClient();
  
  const { data: customer } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!customer) {
    throw new Error('Customer not found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: returnUrl,
  });

  return session.url;
}


