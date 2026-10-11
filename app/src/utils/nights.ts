import type { HistoryNight, SleepNight } from '@/api/types';
import { DEMO_STAGE_SPLIT } from '@/data/sample';
import { toDate } from '@/utils/format';

/** Everything we know about one night, keyed by wake-up date. */
export type DayEntry = {
  day: string;
  score: number | null;
  bed: string | null;
  wake: string | null;
  minutes: number | null;
  source: 'synced' | 'logged';
};

/** Nights from /users/{id}/history as calendar/log entries. Newest first. */
export function dayEntries(history: HistoryNight[]): DayEntry[] {
  return history
    .map((n) => ({
      day: n.day,
      score: n.score,
      bed: n.bedtime,
      wake: n.wake_time,
      minutes: n.duration_min,
      source: n.source === 'manual' ? ('logged' as const) : ('synced' as const),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

export type Stages = { deep: number; light: number; rem: number; awake: number };

export const STAGE_META: { key: keyof Stages; label: string; color: string; about: string }[] = [
  { key: 'deep', label: 'Deep', color: '#9C8DFF', about: 'Body recovery. Most of it happens early in the night.' },
  { key: 'light', label: 'Light', color: '#6FC8FF', about: 'The bulk of the night. Your body and mind settle.' },
  { key: 'rem', label: 'REM', color: '#D9F5FF', about: 'Dreaming. Helps memory and mood, longer toward morning.' },
  { key: 'awake', label: 'Awake', color: '#FFB3C8', about: 'Short wake-ups. A few are normal.' },
];

/** Real stage minutes when the night has them (Apple Health); hand-logged nights fall back to typical proportions. */
export function nightStages(night: SleepNight): Stages {
  if (night.deep_min + night.rem_min > 0) {
    return { deep: night.deep_min, light: night.light_min, rem: night.rem_min, awake: night.awake_min };
  }
  return demoStages(night.duration_min);
}

/** Minutes per stage from typical proportions, for nights without stage data. */
export function demoStages(totalMinutes: number): Stages {
  return {
    deep: Math.round(totalMinutes * DEMO_STAGE_SPLIT.deep),
    light: Math.round(totalMinutes * DEMO_STAGE_SPLIT.light),
    rem: Math.round(totalMinutes * DEMO_STAGE_SPLIT.rem),
    awake: Math.round(totalMinutes * DEMO_STAGE_SPLIT.awake),
  };
}

/** Local minutes after midnight for an ISO date-time. */
export const minutesOfDay = (iso: string) => {
  const d = toDate(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** YYYY-MM-DD in local time. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Device-local ISO date-time with no UTC offset (what POST /me/sleep expects), e.g. 2026-10-10T23:15:00. */
export const localIso = (d: Date) =>
  `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
