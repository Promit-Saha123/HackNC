import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api/client';
import type { HistoryNight, Overview } from '@/api/types';
import { useUser } from '@/state/user';

/**
 * Current user's overview plus their last 60 nights. Refetches on pull-to-refresh, when the app returns to
 * the foreground (e.g. after the Shortcut), and after any change the user makes (logged night, goals, squad).
 */
export function useOverview() {
  const { userId, version } = useUser();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<HistoryNight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    Promise.all([api.overview(userId), api.history(userId, 60).catch(() => null)])
      .then(([o, h]) => {
        if (!live) return;
        setOverview(o);
        if (h) setHistory(h);
        setError(null);
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
  }, [userId, tick, version]);

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
  return { overview, history, error, setError, refreshing, refresh, tick: tick + version, userId };
}
