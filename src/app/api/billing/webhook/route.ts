import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/services/stripe/client';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// Disable body parsing, we need raw body for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    // Check if we've already processed this event (idempotency)
    const { data: existing } = await supabase
      .from('billing_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', event.id)
      .single();

    if (existing) {
      console.log(`Event ${event.id} already processed`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string;

        if (!userId || !subscriptionId) {
          console.error('Missing userId or subscriptionId in checkout session');
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        let planId = 'free';
        if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
          planId = 'pro';
        } else if (priceId === process.env.STRIPE_PRICE_ID_BUSINESS) {
          planId = 'business';
        }

        // Get or create customer
        let customerId = session.customer as string;
        if (typeof customerId !== 'string') {
          const customer = await stripe.customers.retrieve(customerId);
          customerId = customer.id;
        }

        // Upsert subscription
        await supabase.from('billing_subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          status: subscription.status,
          plan_id: planId,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }, {
          onConflict: 'user_id',
        });

        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer_id
        const { data: customer } = await supabase
          .from('billing_customers')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!customer) {
          console.error(`Customer not found: ${customerId}`);
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        let planId = 'free';
        if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
          planId = 'pro';
        } else if (priceId === process.env.STRIPE_PRICE_ID_BUSINESS) {
          planId = 'business';
        }

        if (event.type === 'customer.subscription.deleted') {
          // Delete subscription
          await supabase
            .from('billing_subscriptions')
            .delete()
            .eq('user_id', customer.user_id);
        } else {
          // Update subscription
          await supabase
            .from('billing_subscriptions')
            .update({
              status: subscription.status,
              plan_id: planId,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('user_id', customer.user_id);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

