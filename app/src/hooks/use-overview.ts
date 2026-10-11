import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api/client';
import type { Overview } from '@/api/types';
import { useUser } from '@/state/user';

/** Current user's overview. Refetches on pull-to-refresh and when the app returns to the foreground (e.g. after the Shortcut). */
export function useOverview() {
  const { userId } = useUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .overview(userId)
      .then((o) => {
        if (live) {
          setOverview(o);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setRefreshing(false);
      });
    return () => {
      live = false;
    };
  }, [userId, tick]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((n) => n + 1);
  }, []);

  /** `tick` bumps on every refetch, so dependent cards (briefing) can refresh too. */
  return { overview, error, setError, refreshing, refresh, tick, userId };
}
