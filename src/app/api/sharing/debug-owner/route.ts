import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { getEffectiveOwnerId } from '@/lib/sharing/activeAccount';
import { createErrorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Debug endpoint to validate shared-account switching.
 * Returns what the server sees for:
 * - current user
 * - active-account cookie
 * - membership row visibility
 * - effectiveOwnerId resolution
 * - whether minimal reads work under RLS
 *
 * NOTE: should be protected (auth required) and safe for production (no secrets).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawCookie = request.cookies.get('c2f_active_account')?.value || null;
    const cookieOwnerId = rawCookie ? decodeURIComponent(rawCookie) : null;

    const { supabase } = createClientFromRequest(request);
    const admin = createAdminClient();

    const effectiveOwnerId = await getEffectiveOwnerId(request, userId);

    // Check membership using RLS (user's view)
    const { data: membership, error: membershipError } = cookieOwnerId
      ? await supabase
          .from('account_members')
          .select('id, owner_id, member_id, role, permissions')
          .eq('owner_id', cookieOwnerId)
          .eq('member_id', userId)
          .maybeSingle()
      : { data: null, error: null };

    // Check membership using admin (bypass RLS) to see if it exists
    const { data: adminMembership, error: adminMembershipError } = cookieOwnerId
      ? await admin
          .from('account_members')
          .select('id, owner_id, member_id, role, permissions')
          .eq('owner_id', cookieOwnerId)
          .eq('member_id', userId)
          .maybeSingle()
      : { data: null, error: null };

    // Minimal reads to see if RLS permits reading owner's data when effectiveOwnerId != userId
    const { data: ownerAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', effectiveOwnerId)
      .limit(1);

    const { data: ownerTransactions, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', effectiveOwnerId)
      .limit(1);

    // Count owner's data using admin client (to confirm data exists)
    const { count: ownerAccountsCount } = cookieOwnerId
      ? await admin
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', cookieOwnerId)
      : { count: 0 };

    const { count: ownerTransactionsCount } = cookieOwnerId
      ? await admin
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', cookieOwnerId)
      : { count: 0 };

    return NextResponse.json({
      data: {
        userId,
        rawCookie,
        cookieOwnerId,
        effectiveOwnerId,
        isViewingSharedAccount: effectiveOwnerId !== userId,
        // Membership via RLS
        membershipFound: !!membership,
        membership: membership || null,
        membershipError: membershipError ? { message: membershipError.message, code: (membershipError as any).code } : null,
        // Membership via Admin (bypass RLS)
        adminMembershipFound: !!adminMembership,
        adminMembership: adminMembership || null,
        adminMembershipError: adminMembershipError ? { message: adminMembershipError.message } : null,
        // RLS read tests
        canReadOwnerAccounts: !!ownerAccounts && ownerAccounts.length > 0,
        accountsError: accountsError ? { message: accountsError.message, code: (accountsError as any).code } : null,
        canReadOwnerTransactions: !!ownerTransactions && ownerTransactions.length > 0,
        transactionsError: txError ? { message: txError.message, code: (txError as any).code } : null,
        // Owner's data counts (via admin)
        ownerAccountsCount: ownerAccountsCount || 0,
        ownerTransactionsCount: ownerTransactionsCount || 0,
      },
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}

