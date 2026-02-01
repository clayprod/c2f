import { getStripeClient } from './client';
import { createClient } from '@/lib/supabase/server';
import { PLAN_PRICE_IDS } from './client';
import { getOrCreateStripeCustomer } from './customer';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';

export async function getUserPlan(userId: string): Promise<{
  plan: 'free' | 'pro' | 'premium';
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

  let planId = subscription.plan_id;
  if (planId === 'business') planId = 'premium';

  return {
    plan: planId as 'free' | 'pro' | 'premium',
    status: subscription.status,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
  };
}

/**
 * Get a user's plan using service-role (bypasses RLS).
 * Needed to compute plan for shared-account owner when invitee is browsing.
 */
export async function getUserPlanAdmin(userId: string): Promise<{
  plan: 'free' | 'pro' | 'premium';
  status: string;
  current_period_end: Date | null;
}> {
  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from('billing_subscriptions')
    .select('plan_id, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (!subscription || subscription.status !== 'active') {
    return {
      plan: 'free',
      status: 'active',
      current_period_end: null,
    };
  }

  let planId = subscription.plan_id as string;
  if (planId === 'business') planId = 'premium';

  return {
    plan: planId as 'free' | 'pro' | 'premium',
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
  console.log('[Stripe] Price ID to use:', priceId);
  
  // Verificar se o price é recorrente antes de criar a sessão
  try {
    const price = await stripe.prices.retrieve(priceId);
    console.log('[Stripe] Price details:', {
      id: price.id,
      type: price.type,
      recurring: price.recurring,
      active: price.active,
    });
    
    if (!price.recurring) {
      throw new Error(`Price ${priceId} não é recorrente. Para criar uma assinatura, o price deve ter recurring configurado.`);
    }
  } catch (error: any) {
    console.error('[Stripe] Error validating price:', error);
    throw new Error(`Erro ao validar price: ${error.message}`);
  }
  
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
    .maybeSingle();

  let stripeCustomerId = customer?.stripe_customer_id || null;

  if (!stripeCustomerId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.email) {
      throw new AppError('User email not found', 400, 'user_email_not_found');
    }

    stripeCustomerId = await getOrCreateStripeCustomer(userId, authData.user.email);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function cancelSubscription(userId: string): Promise<void> {
  const stripe = getStripeClient();
  const supabase = await createClient();

  console.log(`[Stripe] Attempting to cancel subscription for user: ${userId}`);

  // Get customer_id first
  const { data: customer, error: customerError } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (customerError || !customer?.stripe_customer_id) {
    console.error('[Stripe] Error fetching customer:', customerError);
    throw new Error('Cliente não encontrado. Entre em contato com o suporte.');
  }

  console.log(`[Stripe] Found customer: ${customer.stripe_customer_id}`);

  // Get subscription from database - check for any subscription that's not cancelled/deleted
  const { data: subscription, error: subError } = await supabase
    .from('billing_subscriptions')
    .select('stripe_subscription_id, status, stripe_customer_id')
    .eq('user_id', userId)
    .not('status', 'eq', 'canceled')
    .not('status', 'eq', 'deleted')
    .maybeSingle();

  if (subError) {
    console.error('[Stripe] Error fetching subscription:', subError);
    throw new Error(`Erro ao buscar assinatura: ${subError.message}`);
  }

  let stripeSubscriptionId: string | null = null;
  let stripeSubscription: any = null;

  // Try to retrieve subscription using the ID from database
  if (subscription?.stripe_subscription_id) {
    console.log(`[Stripe] Found subscription in DB: ${subscription.stripe_subscription_id}, status: ${subscription.status}`);
    
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      stripeSubscriptionId = subscription.stripe_subscription_id;
      console.log(`[Stripe] Successfully retrieved subscription from Stripe: ${stripeSubscription.status}`);
    } catch (error: any) {
      console.warn(`[Stripe] Subscription ${subscription.stripe_subscription_id} not found in Stripe (${error.code}), will search by customer`);
      // Subscription ID in DB doesn't exist in Stripe - will search by customer
    }
  }

  // If subscription not found by ID, search by customer_id
  if (!stripeSubscription) {
    console.log(`[Stripe] Searching for active subscriptions for customer: ${customer.stripe_customer_id}`);
    
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.stripe_customer_id,
        status: 'all',
        limit: 10,
      });

      console.log(`[Stripe] Found ${subscriptions.data.length} subscription(s) for customer`);

      // Find active or trialing subscription
      const activeSub = subscriptions.data.find(
        sub => ['active', 'trialing'].includes(sub.status) && !sub.cancel_at_period_end
      );

      if (activeSub) {
        stripeSubscription = activeSub;
        stripeSubscriptionId = activeSub.id;
        console.log(`[Stripe] Found active subscription: ${stripeSubscriptionId}, status: ${stripeSubscription.status}`);
        
        // Update database with correct subscription ID
        if (subscription) {
          await supabase
            .from('billing_subscriptions')
            .update({
              stripe_subscription_id: stripeSubscriptionId,
              status: stripeSubscription.status,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          console.log(`[Stripe] Updated database with correct subscription ID`);
        }
      } else {
        // Check if there's a subscription marked for cancellation
        const cancellingSub = subscriptions.data.find(sub => sub.cancel_at_period_end);
        if (cancellingSub) {
          throw new Error('Assinatura já está marcada para cancelamento');
        }
        
        // No active subscription found
        if (subscription) {
          // Clean up orphaned record
          await supabase
            .from('billing_subscriptions')
            .delete()
            .eq('user_id', userId);
          console.log(`[Stripe] Cleaned up orphaned subscription record`);
        }
        
        throw new Error('Nenhuma assinatura ativa encontrada no Stripe. Se você tinha uma assinatura, ela pode ter sido cancelada ou expirada.');
      }
    } catch (error: any) {
      if (error.message && error.message.includes('já está marcada')) {
        throw error;
      }
      console.error('[Stripe] Error searching subscriptions by customer:', error);
      throw new Error(`Erro ao buscar assinaturas no Stripe: ${error.message}`);
    }
  }

  if (!stripeSubscription || !stripeSubscriptionId) {
    throw new Error('Assinatura não encontrada. Entre em contato com o suporte.');
  }

  // Check if already cancelled
  if (stripeSubscription.cancel_at_period_end) {
    throw new Error('Assinatura já está marcada para cancelamento');
  }

  // Only allow cancellation for active or trialing subscriptions
  if (!['active', 'trialing'].includes(stripeSubscription.status)) {
    throw new Error(`Não é possível cancelar uma assinatura com status "${stripeSubscription.status}". Entre em contato com o suporte.`);
  }

  // Cancel subscription at end of billing period
  try {
    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    console.log(`[Stripe] Subscription ${stripeSubscriptionId} marked for cancellation at period end`);
    console.log(`[Stripe] Cancel at: ${updated.cancel_at ? new Date(updated.cancel_at * 1000).toISOString() : 'end of period'}`);
  } catch (error: any) {
    console.error('[Stripe] Error updating subscription:', error);
    if (error.code === 'resource_missing') {
      throw new Error('Assinatura não encontrada no Stripe. Entre em contato com o suporte.');
    }
    throw new Error(`Erro ao cancelar assinatura: ${error.message}`);
  }

  // Update local database to reflect cancellation status
  // The webhook will update it properly, but we update immediately for better UX
  const { error: updateError } = await supabase
    .from('billing_subscriptions')
    .update({
      status: stripeSubscription.status, // Keep current status until period end
      stripe_subscription_id: stripeSubscriptionId, // Ensure correct ID
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[Stripe] Error updating local subscription:', updateError);
    // Don't throw here - the Stripe update was successful, local update is just for UX
  }
}

/**
 * Create a manual subscription in Stripe (for admin-granted plans)
 */
export async function createManualSubscription(
  userId: string,
  userEmail: string,
  priceId: string,
  periodEnd: Date
): Promise<string> {
  const stripe = getStripeClient();
  const supabase = await createClient();

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(userId, userEmail);

  // Calculate billing period anchor (current date)
  const now = Math.floor(Date.now() / 1000);
  const periodEndUnix = Math.floor(periodEnd.getTime() / 1000);
  const billingPeriodDays = Math.ceil((periodEndUnix - now) / (24 * 60 * 60));

  // Create subscription in Stripe with metadata indicating it's manual
  // Note: Stripe requires a payment method, but we can use a free trial or set collection_method to 'send_invoice'
  // For manual plans, we'll create a subscription that won't charge automatically
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      metadata: {
        is_manual: 'true',
        user_id: userId,
        granted_by_admin: 'true',
      },
      // Set collection method to send invoice (won't auto-charge)
      collection_method: 'send_invoice',
      // Set billing cycle anchor to current time
      billing_cycle_anchor: now,
      // Set trial end to period end (effectively making it free until then)
      trial_end: periodEndUnix,
      // Don't auto-charge (Stripe typings expect number | undefined)
      // Omitting is equivalent to leaving Stripe default.
    });

    return subscription.id;
  } catch (error: any) {
    // If creating subscription fails, try alternative approach: create without payment method
    // This might fail if Stripe requires payment method, but we'll handle gracefully
    console.warn('[Stripe] Failed to create subscription with send_invoice, trying alternative:', error.message);
    
    // Alternative: Create subscription and immediately cancel it, but keep it active until period end
    // Actually, better approach: create subscription with a very long trial period
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: priceId,
          },
        ],
        metadata: {
          is_manual: 'true',
          user_id: userId,
          granted_by_admin: 'true',
        },
        trial_end: periodEndUnix,
        // Set to cancel at period end
        cancel_at_period_end: false, // Don't cancel, just let trial expire
      });

      return subscription.id;
    } catch (retryError: any) {
      console.error('[Stripe] Failed to create manual subscription:', retryError);
      // Return empty string to indicate failure - caller can handle gracefully
      throw new Error(`Failed to create Stripe subscription: ${retryError.message}`);
    }
  }
}

/**
 * Cancel a subscription by Stripe subscription ID
 */
export async function cancelSubscriptionById(subscriptionId: string): Promise<void> {
  const stripe = getStripeClient();

  try {
    // Cancel immediately (not at period end)
    await stripe.subscriptions.cancel(subscriptionId);
    console.log(`[Stripe] Subscription ${subscriptionId} canceled immediately`);
  } catch (error: any) {
    if (error.code === 'resource_missing') {
      console.warn(`[Stripe] Subscription ${subscriptionId} not found in Stripe`);
      return; // Already deleted, that's fine
    }
    throw error;
  }
}


