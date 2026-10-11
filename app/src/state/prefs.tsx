import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '@/api/client';
import type { Prefs as ServerPrefs, SquadInfo } from '@/api/types';
import { DEFAULT_GOALS } from '@/data/sample';
import { useUser } from '@/state/user';

export type Goals = {
  /** Minutes after midnight. */
  bedtime: number;
  wake: number;
  hours: number;
};

export type Privacy = { share_details: boolean; show_on_board: boolean };

export type Squad = SquadInfo;

type Prefs = {
  goals: Goals;
  /** Saves on the server; throws (and rolls back) if that fails. */
  setGoals: (g: Goals) => Promise<void>;
  privacy: Privacy;
  setPrivacy: (p: Partial<Privacy>) => Promise<void>;
  /** The user's squad from the server; null when not in one. */
  squad: Squad | null;
  /** Call after creating, joining or leaving a squad through the API. */
  setSquad: (s: Squad | null) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

/** Prefs belong to the signed-in user: switching accounts starts fresh. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  return <UserPrefs key={userId}>{children}</UserPrefs>;
}

const DEFAULT_PRIVACY: Privacy = { share_details: true, show_on_board: true };

/** Goals, privacy and squad, loaded from /me/prefs and /me/squad once per sign-in. */
function UserPrefs({ children }: { children: ReactNode }) {
  const { signedIn, bump } = useUser();
  const [server, setServer] = useState<ServerPrefs>({ ...DEFAULT_GOALS, ...DEFAULT_PRIVACY });
  const [squad, setSquadState] = useState<Squad | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api.prefs().then((p) => live && setServer(p)).catch(() => {});
    api.mySquad().then((s) => live && setSquadState(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn]);

  const save = useCallback(
    async (patch: Partial<ServerPrefs>) => {
      const prev = server;
      const next = { ...server, ...patch };
      setServer(next); // optimistic
      try {
        setServer(await api.savePrefs(next));
        bump(); // goals change the score, privacy changes the boards
      } catch (e) {
        setServer(prev);
        throw e;
      }
    },
    [server, bump],
  );

  const setSquad = useCallback(
    (s: Squad | null) => {
      setSquadState(s);
      bump();
    },
    [bump],
  );

  const value = useMemo<Prefs>(
    () => ({
      goals: { bedtime: server.bedtime ?? DEFAULT_GOALS.bedtime, wake: server.wake ?? DEFAULT_GOALS.wake, hours: server.hours ?? DEFAULT_GOALS.hours },
      setGoals: (g) => save(g),
      privacy: { share_details: server.share_details ?? true, show_on_board: server.show_on_board ?? true },
      setPrivacy: (p) => save(p),
      squad,
      setSquad,
    }),
    [server, save, squad, setSquad],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
