'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Member {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

interface UseMembersReturn {
  members: Member[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get list of members who can be assigned to transactions
 * This includes the owner and all shared members
 */
export function useMembers(): UseMembersReturn {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/sharing/context');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      const context = data.data;
      const membersList: Member[] = [];

      // Add own account as first member
      if (context.ownAccount) {
        membersList.push({
          id: context.ownAccount.id,
          fullName: context.ownAccount.fullName,
          email: context.ownAccount.email,
          avatarUrl: context.ownAccount.avatarUrl,
        });
      }

      // Add shared members
      if (context.members) {
        for (const member of context.members) {
          membersList.push({
            id: member.memberId,
            fullName: member.memberName,
            email: member.memberEmail,
            avatarUrl: member.memberAvatarUrl,
          });
        }
      }

      setMembers(membersList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    refresh: fetchMembers,
  };
}
