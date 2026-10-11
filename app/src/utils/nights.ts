import type { Overview } from '@/api/types';
import { DEMO_STAGE_SPLIT } from '@/data/sample';
import type { ManualLog } from '@/state/prefs';

/** Everything we know about one night, keyed by wake-up date. */
export type DayEntry = {
  day: string;
  score: number | null;
  bed: string | null;
  wake: string | null;
  minutes: number | null;
  source: 'synced' | 'logged';
};

const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

/** Merges synced history (scores, last night's times) with nights logged by hand. Newest first. */
export function dayEntries(overview: Overview | null, logs: ManualLog[]): DayEntry[] {
  const map = new Map<string, DayEntry>();
  for (const h of overview?.history ?? []) {
    map.set(h.day, { day: h.day, score: h.score, bed: null, wake: null, minutes: null, source: 'synced' });
  }
  const last = overview?.last_night;
  if (last) {
    const prev = map.get(last.day);
    map.set(last.day, {
      day: last.day,
      score: prev?.score ?? overview?.score?.score ?? null,
      bed: last.bedtime,
      wake: last.wake_time,
      minutes: last.duration_min,
      source: 'synced',
    });
  }
  for (const l of logs) {
    const prev = map.get(l.day);
    map.set(l.day, {
      day: l.day,
      score: prev?.score ?? null,
      bed: l.bed,
      wake: l.wake,
      minutes: minutesBetween(l.bed, l.wake),
      source: 'logged',
    });
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export type Stages = { deep: number; light: number; rem: number; awake: number };

export const STAGE_META: { key: keyof Stages; label: string; color: string; about: string }[] = [
  { key: 'deep', label: 'Deep', color: '#7E44FC', about: 'Body recovery. Most of it happens early in the night.' },
  { key: 'light', label: 'Light', color: '#1476FD', about: 'The bulk of the night. Your body and mind settle.' },
  { key: 'rem', label: 'REM', color: '#38C8FF', about: 'Dreaming. Helps memory and mood, longer toward morning.' },
  { key: 'awake', label: 'Awake', color: '#FB4FCE', about: 'Short wake-ups. A few are normal.' },
];

/** Minutes per stage for a night. Uses demo proportions: there is no real stage tracking yet. */
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
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** YYYY-MM-DD in local time. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
