import { getStripeClient } from './client';
import { createClient } from '@/lib/supabase/server';

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const supabase = await createClient();
  
  // Check if customer already exists
  const { data: existing } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  // Create new customer in Stripe
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });

  // Save to database
  await supabase.from('billing_customers').insert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  return customer.id;
}


