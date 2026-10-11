import { createContext, useContext, type ReactNode } from 'react';

import { skyAt, type Sky } from '@/utils/sky';

/**
 * The app is always night: a fixed hour (about 3:30 am) that puts the crescent moon in the upper right
 * with full stars. Change NIGHT_HOUR to move the moon along its arc.
 */
const NIGHT_HOUR = 3.5;
const NIGHT_SKY: Sky & { hour: number } = { ...skyAt(NIGHT_HOUR), hour: NIGHT_HOUR };

const SkyContext = createContext<Sky & { hour: number }>(NIGHT_SKY);

/** Shares the (fixed) night sky with every screen. */
export function SkyProvider({ children }: { children: ReactNode }) {
  return <SkyContext.Provider value={NIGHT_SKY}>{children}</SkyContext.Provider>;
}

export function useSky() {
  return useContext(SkyContext);
}
