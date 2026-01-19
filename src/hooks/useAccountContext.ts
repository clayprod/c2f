'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

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

interface UseAccountContextReturn {
  context: AccountContext | null;
  loading: boolean;
  error: string | null;
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
  isViewingSharedAccount: boolean;
  currentPermissions: Record<string, unknown> | null;
  hasPermission: (resource: string, action?: string) => boolean;
  refresh: () => Promise<void>;
}

export function useAccountContext(): UseAccountContextReturn {
  const [context, setContext] = useState<AccountContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Initialize from localStorage synchronously so we don't wipe the server cookie on first mount.
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('c2f_active_account');
    } catch {
      return null;
    }
  });

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/sharing/context');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch account context');
      }

      setContext(data.data);
      
      // Default to own account if no active account is set
      if (!activeAccountId && data.data) {
        setActiveAccountIdState(data.data.currentUserId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const setActiveAccountId = useCallback((id: string | null) => {
    setActiveAccountIdState(id);
    // Store in localStorage for persistence
    try {
      if (id) {
        localStorage.setItem('c2f_active_account', id);
      } else {
        localStorage.removeItem('c2f_active_account');
      }
    } catch {
      // ignore
    }
  }, []);

  // No need for a separate "load from localStorage" effect since we initialize above.

  const isViewingSharedAccount = 
    activeAccountId !== null && 
    context !== null && 
    activeAccountId !== context.currentUserId;

  const currentPermissions = isViewingSharedAccount
    ? context?.sharedAccounts.find(sa => sa.ownerId === activeAccountId)?.permissions || null
    : null;

  const hasPermission = useCallback((resource: string, action: string = 'view'): boolean => {
    // If viewing own account, always has full permission
    if (!isViewingSharedAccount) return true;
    if (!currentPermissions) return false;

    const resourcePerm = currentPermissions[resource];
    
    if (typeof resourcePerm === 'boolean') {
      return resourcePerm;
    }
    
    if (typeof resourcePerm === 'object' && resourcePerm !== null) {
      return (resourcePerm as Record<string, boolean>)[action] ?? false;
    }
    
    return false;
  }, [isViewingSharedAccount, currentPermissions]);

  return {
    context,
    loading,
    error,
    activeAccountId,
    setActiveAccountId,
    isViewingSharedAccount,
    currentPermissions,
    hasPermission,
    refresh: fetchContext,
  };
}

// Context for sharing across components
const AccountContextContext = createContext<UseAccountContextReturn | null>(null);

export function useAccountContextFromProvider(): UseAccountContextReturn {
  const context = useContext(AccountContextContext);
  if (!context) {
    throw new Error('useAccountContextFromProvider must be used within AccountContextProvider');
  }
  return context;
}

export { AccountContextContext };
