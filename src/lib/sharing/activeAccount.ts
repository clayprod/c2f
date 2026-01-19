import { createClientFromRequest } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

const ACTIVE_ACCOUNT_COOKIE = 'c2f_active_account';

/**
 * Resolves which account owner_id should be used for data queries.
 *
 * Rules:
 * - Default: current userId
 * - If cookie is set:
 *   - allow if cookie === userId (own account)
 *   - allow if current user is a member of that owner_id (account_members)
 *   - otherwise fallback to userId
 */
export async function getEffectiveOwnerId(request: NextRequest, userId: string): Promise<string> {
  const raw = request.cookies.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  const cookieOwnerId = raw ? decodeURIComponent(raw) : null;
  if (!cookieOwnerId) return userId;

  // Own account is always allowed
  if (cookieOwnerId === userId) return userId;

  // Validate membership (prevents arbitrary cookie spoofing)
  const { supabase } = createClientFromRequest(request);
  const { data: membership, error } = await supabase
    .from('account_members')
    .select('id')
    .eq('owner_id', cookieOwnerId)
    .eq('member_id', userId)
    .maybeSingle();

  if (error) {
    // Fail closed to user's own account
    return userId;
  }

  return membership ? cookieOwnerId : userId;
}

