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
  const stripe = getStripeClient();
  const supabase = await createClient();
  
  // Get user email
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    throw new Error('User email not found');
  }
  
  const customerId = await getOrCreateStripeCustomer(userId, user.email);

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


