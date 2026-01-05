import { getStripeClient } from './client';
import { createClient } from '@/lib/supabase/server';

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  console.log('[Stripe Customer] Looking for existing customer...');
  const supabase = await createClient();

  // Check if customer already exists
  const { data: existing, error: selectError } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('[Stripe Customer] Error checking existing customer:', selectError);
  }

  if (existing?.stripe_customer_id) {
    console.log('[Stripe Customer] Found existing customer:', existing.stripe_customer_id);
    return existing.stripe_customer_id;
  }

  // Create new customer in Stripe
  console.log('[Stripe Customer] Creating new Stripe customer for:', email);
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });
  console.log('[Stripe Customer] Created Stripe customer:', customer.id);

  // Save to database
  console.log('[Stripe Customer] Saving customer to database...');
  const { error: insertError } = await supabase.from('billing_customers').insert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  if (insertError) {
    console.error('[Stripe Customer] Error saving customer to database:', insertError);
    // Don't throw - customer was created in Stripe, we can continue
  }

  return customer.id;
}





