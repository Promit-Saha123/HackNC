import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_GOALS } from '@/data/sample';

export type Goals = {
  /** Minutes after midnight. */
  bedtime: number;
  wake: number;
  hours: number;
};

/** A night entered by hand in Log Sleep. `day` is the wake-up date (YYYY-MM-DD). */
export type ManualLog = { day: string; bed: string; wake: string };

export type Squad = { name: string; code: string };

type Prefs = {
  goals: Goals;
  setGoals: (g: Goals) => void;
  logs: ManualLog[];
  addLog: (log: ManualLog) => void;
  /** Squad created or joined in the app; null means use the backend's squad. */
  squad: Squad | null;
  setSquad: (s: Squad | null) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

// TODO(P1/P2): these live only in memory for now. Goals, manual logs and squads need backend endpoints.
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [logs, setLogs] = useState<ManualLog[]>([]);
  const [squad, setSquad] = useState<Squad | null>(null);

  const value = useMemo<Prefs>(
    () => ({
      goals,
      setGoals,
      logs,
      // One log per night: a new entry for the same day replaces the old one.
      addLog: (log) => setLogs((prev) => [...prev.filter((l) => l.day !== log.day), log]),
      squad,
      setSquad,
    }),
    [goals, logs, squad],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
