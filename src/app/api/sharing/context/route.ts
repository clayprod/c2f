import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AccountContext {
  currentUserId: string;
  ownAccount: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
  };
  sharedAccounts: Array<{
    ownerId: string;
    ownerEmail: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
    role: string;
    permissions: Record<string, unknown>;
  }>;
  members: Array<{
    memberId: string;
    memberEmail: string;
    memberName: string;
    memberAvatarUrl: string | null;
    role: string;
    permissions: Record<string, unknown>;
  }>;
}

// GET - Get the current user's account context (own account + shared access)
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Get accounts this user has access to (as a member)
    const { data: sharedAccounts, error: sharedError } = await supabase
      .from('account_members')
      .select(`
        owner_id,
        role,
        permissions,
        profiles:owner_id (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('member_id', userId);

    if (sharedError) throw sharedError;

    // Get members who have access to this user's account
    const { data: members, error: membersError } = await supabase
      .from('account_members')
      .select(`
        member_id,
        role,
        permissions,
        profiles:member_id (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('owner_id', userId);

    if (membersError) throw membersError;

    // profiles table RLS only allows "view own profile", so joins for other users
    // often return null. Enrich owner/member profile fields via service-role (server-side).
    const enrichProfiles = async () => {
      try {
        const admin = createAdminClient();

        const ownerIdsToFetch = Array.from(
          new Set(
            (sharedAccounts || [])
              .map((sa: any) => sa.owner_id as string)
              .filter(Boolean)
              .filter((ownerId: string) => {
                const p = (sharedAccounts as any[])?.find((x: any) => x.owner_id === ownerId)?.profiles;
                return !p?.email && !p?.full_name && !p?.avatar_url;
              })
          )
        );

        const memberIdsToFetch = Array.from(
          new Set(
            (members || [])
              .map((m: any) => m.member_id as string)
              .filter(Boolean)
              .filter((memberId: string) => {
                const p = (members as any[])?.find((x: any) => x.member_id === memberId)?.profiles;
                return !p?.email && !p?.full_name && !p?.avatar_url;
              })
          )
        );

        const ids = Array.from(new Set([...ownerIdsToFetch, ...memberIdsToFetch]));
        if (ids.length === 0) return { ownersById: new Map<string, any>(), membersById: new Map<string, any>() };

        const { data: profilesData } = await admin
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .in('id', ids);

        const byId = new Map<string, any>((profilesData || []).map((p: any) => [p.id, p]));
        return { ownersById: byId, membersById: byId };
      } catch {
        return { ownersById: new Map<string, any>(), membersById: new Map<string, any>() };
      }
    };

    const { ownersById, membersById } = await enrichProfiles();

    const context: AccountContext = {
      currentUserId: userId,
      ownAccount: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name || '',
        avatarUrl: profile.avatar_url,
      },
      sharedAccounts: (sharedAccounts || []).map((sa) => {
        const ownerProfile = (sa.profiles as any) || ownersById.get(sa.owner_id) || null;
        return {
          ownerId: sa.owner_id,
          ownerEmail: ownerProfile?.email || '',
          ownerName: ownerProfile?.full_name || '',
          ownerAvatarUrl: ownerProfile?.avatar_url || null,
          role: sa.role,
          permissions: sa.permissions as Record<string, unknown>,
        };
      }),
      members: (members || []).map((m) => {
        const memberProfile = (m.profiles as any) || membersById.get(m.member_id) || null;
        return {
          memberId: m.member_id,
          memberEmail: memberProfile?.email || '',
          memberName: memberProfile?.full_name || '',
          memberAvatarUrl: memberProfile?.avatar_url || null,
          role: m.role,
          permissions: m.permissions as Record<string, unknown>,
        };
      }),
    };

    return NextResponse.json({ data: context });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}
