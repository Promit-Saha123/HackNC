import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { nowHour, skyAt, type Sky } from '@/utils/sky';

type SkyState = Sky & {
  hour: number;
  /** null = follow the phone's clock. */
  preview: number | null;
  setPreview: (h: number | null) => void;
};

const SkyContext = createContext<SkyState | null>(null);

/** Shares the time-of-day sky with every screen. Re-reads the clock every minute so the scene drifts slowly. */
export function SkyProvider({ children }: { children: ReactNode }) {
  const [clock, setClock] = useState(nowHour);
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClock(nowHour()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour = preview ?? clock;
  const value = useMemo(() => ({ ...skyAt(hour), hour, preview, setPreview }), [hour, preview]);
  return <SkyContext.Provider value={value}>{children}</SkyContext.Provider>;
}

export function useSky() {
  const ctx = useContext(SkyContext);
  if (!ctx) throw new Error('useSky must be used inside SkyProvider');
  return ctx;
}
