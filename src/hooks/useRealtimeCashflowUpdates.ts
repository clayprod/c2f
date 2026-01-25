import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UseRealtimeCashflowUpdatesOptions = {
  ownerId: string | null;
  onRefresh: () => void;
  enabled?: boolean;
  debounceMs?: number;
  minIntervalMs?: number;
  pollingIntervalMs?: number;
  tables?: string[];
  events?: Array<'INSERT' | 'UPDATE' | 'DELETE' | '*'>;
  refreshOnFocus?: boolean;
  refreshOnVisibility?: boolean;
};

const CASHFLOW_TABLES = [
  'transactions',
  'budgets',
  'credit_card_bills',
  'investment_transactions',
  'goal_contributions',
  'debt_payments',
  'receivable_payments',
];

export function useRealtimeCashflowUpdates({
  ownerId,
  onRefresh,
  enabled = true,
  debounceMs = 400,
  minIntervalMs = 1000,
  pollingIntervalMs = 60000,
  tables = CASHFLOW_TABLES,
  events = ['*'],
  refreshOnFocus = true,
  refreshOnVisibility = true,
}: UseRealtimeCashflowUpdatesOptions) {
  const [supabase] = useState(() => createClient());
  const refreshRef = useRef(onRefresh);
  const timeoutRef = useRef<number | null>(null);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  const scheduleRefresh = useCallback(() => {
    if (!enabled || !ownerId) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    const now = Date.now();
    const sinceLast = now - lastRefreshRef.current;
    const wait = Math.max(debounceMs, minIntervalMs - sinceLast);

    timeoutRef.current = window.setTimeout(() => {
      lastRefreshRef.current = Date.now();
      refreshRef.current();
    }, wait);
  }, [debounceMs, enabled, minIntervalMs, ownerId]);

  useEffect(() => {
    if (!enabled || !ownerId) return;

    const channel = supabase.channel(`cashflow-updates:${ownerId}`);

    tables.forEach((table) => {
      events.forEach((event) => {
        (channel as any).on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
            filter: `user_id=eq.${ownerId}`,
          },
          () => {
            scheduleRefresh();
          }
        );
      });
    });

    channel.subscribe();

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [enabled, events, ownerId, scheduleRefresh, supabase, tables]);

  useEffect(() => {
    if (!enabled || !ownerId || (!refreshOnFocus && !refreshOnVisibility)) return;

    const handleVisibility = () => {
      if (refreshOnVisibility && document.visibilityState === 'visible') {
        scheduleRefresh();
      }
    };

    if (refreshOnFocus) {
      window.addEventListener('focus', scheduleRefresh);
    }
    if (refreshOnVisibility) {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (refreshOnFocus) {
        window.removeEventListener('focus', scheduleRefresh);
      }
      if (refreshOnVisibility) {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [enabled, ownerId, refreshOnFocus, refreshOnVisibility, scheduleRefresh]);

  useEffect(() => {
    if (!enabled || !ownerId || !pollingIntervalMs) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh();
      }
    }, pollingIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, ownerId, pollingIntervalMs, scheduleRefresh]);
}
