/**
 * User Plans Management Service
 * Handles admin operations for granting and revoking user plans
 */

import { createClient, createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createManualSubscription, cancelSubscriptionById } from '@/services/stripe/subscription';
import { PLAN_PRICE_IDS } from '@/services/stripe/client';
import { NextRequest } from 'next/server';

export interface UserPlanInfo {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  plan: 'free' | 'pro' | 'premium';
  status: string;
  current_period_end: Date | null;
  is_manual: boolean;
  granted_by: string | null;
  granted_at: Date | null;
  stripe_subscription_id: string | null;
}

export interface ListUsersFilters {
  plan?: 'free' | 'pro' | 'premium';
  status?: 'active' | 'inactive';
  is_manual?: boolean;
  search?: string;
}

export interface ListUsersPagination {
  page?: number;
  limit?: number;
}

export interface ListUsersResult {
  users: UserPlanInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * List users with their plan information
 */
export async function listUsers(
  filters: ListUsersFilters = {},
  pagination: ListUsersPagination = {},
  request?: NextRequest
): Promise<ListUsersResult> {
  // Use admin client (service_role) to bypass RLS for admin operations
  // This is necessary because joins with billing_subscriptions can fail with RLS
  // even when admin policies exist, due to how Supabase applies RLS to joined tables.
  // This function is only called from admin API routes that verify admin access.
  // Check if service role key is configured before attempting to create client
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    throw new Error('Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Please configure it in your environment variables.');
  }

  let supabase;
  try {
    supabase = createAdminClient();
    console.log('Admin client created successfully');
  } catch (error: any) {
    console.error('Failed to create admin client:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error?.message);
    throw new Error(`Failed to initialize admin client: ${error.message}`);
  }
  const page = pagination.page || 1;
  const limit = pagination.limit || 50;
  const offset = (page - 1) * limit;

  // Build query for profiles
  console.log('Building query for profiles...');
  
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, created_at');

  // Apply search filter
  if (filters.search) {
    query = query.or(`email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`);
  }

  // Limit to reasonable amount to avoid memory issues
  // We'll fetch up to 1000 users and filter in memory
  query = query.order('created_at', { ascending: false }).limit(1000);

  console.log('Executing profiles query...');
  const { data: profiles, error: profilesError } = await query;

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    console.error('Error code:', profilesError.code);
    console.error('Error message:', profilesError.message);
    console.error('Error details:', JSON.stringify(profilesError, null, 2));
    console.error('Error hint:', profilesError.hint);
    throw new Error(`Failed to list users: ${profilesError.message || 'Unknown error'}`);
  }

  console.log(`Fetched ${profiles?.length || 0} profiles from database`);

  // Fetch subscriptions separately and merge
  // Supabase has a limit on .in() queries, so we'll fetch all subscriptions
  // and filter in memory if there are many users
  let subscriptions: any[] = [];
  if (profiles && profiles.length > 0) {
    console.log(`Fetching subscriptions for ${profiles.length} users...`);
    
    // Fetch all subscriptions and filter by user_id in memory
    // This avoids issues with .in() query limits
    // Try to select all fields including manual plan fields (from migration 036)
    let allSubs: any[] | null = null;
    let subsError: any = null;
    
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('user_id, plan_id, status, current_period_end, is_manual, granted_by, granted_at, stripe_subscription_id');
    
    // If error is about missing columns, try without manual plan fields
    if (error && (
      error.message?.includes('granted_at') ||
      error.message?.includes('granted_by') ||
      error.message?.includes('is_manual') ||
      error.message?.includes('schema cache')
    )) {
      console.warn('Migration 036 may not be applied. Fetching subscriptions without manual plan fields...');
      const fallbackResult = await supabase
        .from('billing_subscriptions')
        .select('user_id, plan_id, status, current_period_end, stripe_subscription_id');
      
      allSubs = fallbackResult.data;
      subsError = fallbackResult.error;
    } else {
      allSubs = data;
      subsError = error;
    }

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      console.error('Error code:', subsError.code);
      console.error('Error message:', subsError.message);
      // Don't fail completely if subscriptions query fails, just log it
      subscriptions = [];
    } else {
      // Filter subscriptions to only include users we fetched
      const userIdsSet = new Set(profiles.map(p => p.id));
      subscriptions = (allSubs || []).filter(sub => userIdsSet.has(sub.user_id));
      console.log(`Fetched ${subscriptions.length} subscriptions (from ${allSubs?.length || 0} total)`);
    }
  }

  if (!profiles || profiles.length === 0) {
    return {
      users: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  // Create a map of subscriptions by user_id for quick lookup
  const subscriptionsMap = new Map(
    subscriptions.map(sub => [sub.user_id, sub])
  );

  // Transform data to include plan info
  const users: UserPlanInfo[] = (profiles || []).map((profile: any) => {
    // Get subscription for this user
    const subscription = subscriptionsMap.get(profile.id);
    
    let plan: 'free' | 'pro' | 'premium' = 'free';
    let status = 'inactive'; // Default to inactive for free users
    let current_period_end: Date | null = null;
    let is_manual = false;
    let granted_by: string | null = null;
    let granted_at: Date | null = null;
    let stripe_subscription_id: string | null = null;

    if (subscription) {
      // Use subscription data regardless of status, but check if it's active
      plan = subscription.plan_id === 'business' ? 'premium' : (subscription.plan_id as 'pro' | 'premium');
      status = subscription.status || 'inactive';
      current_period_end = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      is_manual = subscription.is_manual || false;
      granted_by = subscription.granted_by || null;
      granted_at = subscription.granted_at ? new Date(subscription.granted_at) : null;
      stripe_subscription_id = subscription.stripe_subscription_id || null;
    }

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      created_at: profile.created_at,
      plan,
      status,
      current_period_end,
      is_manual,
      granted_by,
      granted_at,
      stripe_subscription_id,
    };
  });

  // Apply filters after transformation
  let filteredUsers = users;
  
  if (filters.plan) {
    filteredUsers = filteredUsers.filter(user => user.plan === filters.plan);
  }
  
  if (filters.status) {
    filteredUsers = filteredUsers.filter(user => {
      const isActive = user.status === 'active' && (user.current_period_end === null || user.current_period_end > new Date());
      return filters.status === 'active' ? isActive : !isActive;
    });
  }
  
  if (filters.is_manual !== undefined) {
    filteredUsers = filteredUsers.filter(user => user.is_manual === filters.is_manual);
  }

  // Calculate totals from filtered results
  const total = filteredUsers.length;
  const totalPages = Math.ceil(total / limit);
  
  // Apply pagination to filtered results
  const paginatedUsers = filteredUsers.slice(offset, offset + limit);

  return {
    users: paginatedUsers,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Grant a plan to a user
 */
export async function grantPlan(
  userId: string,
  plan: 'pro' | 'premium',
  periodMonths: number,
  adminId: string
): Promise<void> {
  // Use admin client (service_role) to bypass RLS for admin operations
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error: any) {
    console.error('Failed to create admin client:', error);
    throw new Error(`Failed to initialize admin client: ${error.message}`);
  }

  console.log(`Granting plan ${plan} to user ${userId} for ${periodMonths} months`);

  // Validate user exists
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('Error fetching user:', userError);
    console.error('Error code:', userError.code);
    console.error('Error message:', userError.message);
    throw new Error(`User not found: ${userError.message}`);
  }

  if (!user) {
    console.error(`User with ID ${userId} not found in database`);
    throw new Error('User not found');
  }

  console.log(`Found user: ${user.email}`);

  // Validate period
  if (periodMonths < 1 || periodMonths > 120) {
    throw new Error('Period must be between 1 and 120 months');
  }

  // Calculate period end date
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

  // Get price ID for the plan
  const priceId = plan === 'pro' ? PLAN_PRICE_IDS.PRO : PLAN_PRICE_IDS.PREMIUM;
  if (!priceId) {
    throw new Error(`Price ID not configured for plan: ${plan}`);
  }

  // Check if user already has a subscription
  const { data: existingSubscription, error: existingSubError } = await supabase
    .from('billing_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingSubError && existingSubError.code !== 'PGRST116') {
    // PGRST116 is "not found" which is OK, but other errors are not
    console.error('Error checking existing subscription:', existingSubError);
    throw new Error(`Failed to check existing subscription: ${existingSubError.message}`);
  }

  if (existingSubscription) {
    console.log(`User already has subscription: ${existingSubscription.plan_id} (${existingSubscription.status})`);
  }

  // Create or update Stripe subscription with manual metadata
  let stripeSubscriptionId: string | null = null;
  try {
    stripeSubscriptionId = await createManualSubscription(userId, user.email, priceId, periodEnd);
  } catch (error: any) {
    console.error('Error creating Stripe subscription:', error);
    // Continue even if Stripe subscription creation fails - we'll still create DB record
  }

  // Get or create Stripe customer ID
  const { data: customer, error: customerError } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (customerError && customerError.code !== 'PGRST116') {
    console.error('Error fetching customer:', customerError);
    // Continue anyway, we'll use 'manual' as fallback
  }

  const stripeCustomerId = customer?.stripe_customer_id || 'manual';
  console.log(`Using Stripe customer ID: ${stripeCustomerId}`);

  // Upsert subscription in database
  // First, try with all fields (requires migration 036)
  let subscriptionData: any = {
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    status: 'active',
    plan_id: plan,
    current_period_end: periodEnd.toISOString(),
    is_manual: true,
    granted_by: adminId,
    granted_at: new Date().toISOString(),
  };

  if (stripeSubscriptionId) {
    subscriptionData.stripe_subscription_id = stripeSubscriptionId;
  } else {
    // For manual plans without Stripe subscription, set to null
    // This requires migration 036 which makes stripe_subscription_id nullable
    subscriptionData.stripe_subscription_id = null;
  }

  console.log('Upserting subscription data:', {
    user_id: subscriptionData.user_id,
    plan_id: subscriptionData.plan_id,
    status: subscriptionData.status,
    current_period_end: subscriptionData.current_period_end,
    is_manual: subscriptionData.is_manual,
  });

  let { error: upsertError } = await supabase
    .from('billing_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'user_id',
    });

  // If the error is about missing columns, try without the manual plan fields
  if (upsertError && (
    upsertError.message?.includes('granted_at') ||
    upsertError.message?.includes('granted_by') ||
    upsertError.message?.includes('is_manual') ||
    upsertError.message?.includes('schema cache')
  )) {
    console.warn('Migration 036 may not be applied. Retrying without manual plan fields...');
    console.warn('Please apply migration 036_add_manual_plan_fields.sql to enable full functionality');
    
    // Retry without manual plan fields (fallback for databases without migration 036)
    subscriptionData = {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      status: 'active',
      plan_id: plan,
      current_period_end: periodEnd.toISOString(),
    };

    if (stripeSubscriptionId) {
      subscriptionData.stripe_subscription_id = stripeSubscriptionId;
    }

    const retryResult = await supabase
      .from('billing_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id',
      });

    upsertError = retryResult.error;
    
    if (!upsertError) {
      console.warn('Plan granted successfully, but manual plan tracking fields are not available.');
      console.warn('To enable full functionality, please apply migration 036_add_manual_plan_fields.sql');
    }
  }

  if (upsertError) {
    console.error('Error upserting subscription:', upsertError);
    console.error('Error code:', upsertError.code);
    console.error('Error message:', upsertError.message);
    console.error('Error details:', upsertError.details);
    console.error('Error hint:', upsertError.hint);
    throw new Error(`Failed to grant plan: ${upsertError.message}`);
  }

  console.log(`Successfully granted ${plan} plan to user ${user.email}`);
}

/**
 * Revoke a plan from a user
 */
export async function revokePlan(
  userId: string,
  cancelStripe: boolean,
  adminId: string
): Promise<void> {
  // Use admin client (service_role) to bypass RLS for admin operations
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error: any) {
    console.error('Failed to create admin client:', error);
    throw new Error(`Failed to initialize admin client: ${error.message}`);
  }

  console.log(`Revoking plan for user ${userId}, cancelStripe: ${cancelStripe}`);

  // Get existing subscription
  const { data: subscription, error: subError } = await supabase
    .from('billing_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (subError && subError.code !== 'PGRST116') {
    console.error('Error fetching subscription:', subError);
    throw new Error(`Failed to fetch subscription: ${subError.message}`);
  }

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  console.log(`Found subscription: ${subscription.plan_id} (${subscription.status})`);

  // If canceling Stripe subscription and it exists
  if (cancelStripe && subscription.stripe_subscription_id) {
    try {
      await cancelSubscriptionById(subscription.stripe_subscription_id);
    } catch (error: any) {
      console.error('Error canceling Stripe subscription:', error);
      // Continue with database deletion even if Stripe cancellation fails
    }
  }

  // Delete subscription from database
  const { error: deleteError } = await supabase
    .from('billing_subscriptions')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    console.error('Error deleting subscription:', deleteError);
    throw new Error(`Failed to revoke plan: ${deleteError.message}`);
  }

  console.log(`Successfully revoked plan for user ${userId}`);
}
