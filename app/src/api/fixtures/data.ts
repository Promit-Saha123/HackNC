import { localIso } from '../time';
import type { HistoryNight, LeaderboardEntry, Overview, User } from '../types';

/**
 * Mock data mirroring the backend's seeded demo friends (backend/app/store.py PROFILES):
 * same ids, names, squads and sleep stories, 60 deterministic nights each, scored with the same
 * 40·duration + 30·consistency + 20·quality + 10·streak formula (simplified), so overview,
 * history and leaderboards all agree with each other.
 */
const NIGHTS = 60;

type Pattern = 'steady' | 'weekend' | 'exam' | 'improving';
// name, squad, usual bedtime (hours after midnight: 23 = 11pm, 26 = 2am), hours asleep, pattern
const PROFILES: [string, string, number, number, Pattern][] = [
  ['Maya', 'Wolfpack', 22.75, 8.0, 'steady'], // perfect sleeper
  ['Jordan', 'Wolfpack', 23.25, 7.4, 'weekend'], // weekend drift
  ['Sam', 'Wolfpack', 23.5, 7.5, 'exam'], // exam-week crash
  ['Riley', 'Night Owls', 26.0, 6.8, 'steady'], // night owl
  ['Alex', 'Night Owls', 25.0, 5.8, 'improving'], // climbing out of all-nighters
  ['Priya', 'Night Owls', 23.0, 7.8, 'steady'],
  ['Chris', 'Library Rats', 24.0, 7.0, 'weekend'],
  ['Dana', 'Library Rats', 24.25, 6.8, 'steady'],
];

const localDay = (d: Date) => localIso(d).slice(0, 10);

/** Small seeded RNG so every reload shows the same nights. */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  const next = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return { next, gauss: (sd: number) => (next() + next() + next() - 1.5) * sd * 1.4 };
}

const durationPart = (h: number) => (h < 5 ? 0 : h < 7 ? (h - 5) / 2 : h <= 10 ? 1 : Math.max(0.7, 1 - 0.1 * (h - 10)));
const consistencyPart = (off: number) =>
  Math.abs(off) <= 30 ? 1 : Math.abs(off) >= 120 ? 0 : 1 - (Math.abs(off) - 30) / 90;
const round1 = (x: number) => Math.round(x * 10) / 10;
const BADGES: [number, string][] = [[30, 'aurora'], [14, 'rainbow'], [7, 'cloud'], [3, 'moon']];
export const badgeFor = (streak: number) => BADGES.find(([need]) => streak >= need)?.[1] ?? null;

type Scored = { night: HistoryNight; streak: number; parts: { d: number; c: number; q: number; s: number } };

/** Score a night list (oldest first): usual bedtime = mean of the previous 7, like backend/app/scoring.py. */
export function scoreNights(nights: Omit<HistoryNight, 'score'>[]): Scored[] {
  const beds: number[] = [];
  let streak = 0;
  return nights.map((n) => {
    const bed = new Date(n.bedtime);
    const bedFrom18 = (bed.getHours() * 60 + bed.getMinutes() - 18 * 60 + 1440) % 1440; // no midnight wrap
    const prior = beds.slice(-7);
    const offset = prior.length ? bedFrom18 - prior.reduce((a, b) => a + b, 0) / prior.length : 0;
    beds.push(bedFrom18);
    streak = n.duration_min >= 420 && Math.abs(offset) <= 60 ? streak + 1 : 0;
    const parts = {
      d: 40 * durationPart(n.duration_min / 60),
      c: 30 * consistencyPart(offset),
      q: 20 * Math.min(1, Math.max(0, n.efficiency)),
      s: 10 * Math.min(streak / 14, 1),
    };
    return { night: { ...n, score: round1(parts.d + parts.c + parts.q + parts.s) }, streak, parts };
  });
}

function genNights(uid: number, bedH: number, sleepH: number, kind: Pattern): Omit<HistoryNight, 'score'>[] {
  const r = rng(uid);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Omit<HistoryNight, 'score'>[] = [];
  for (let i = 0; i < NIGHTS; i++) {
    const wakeDay = new Date(today);
    wakeDay.setDate(today.getDate() - (NIGHTS - 1 - i));
    let bedMin = bedH * 60 + r.gauss(12);
    let hours = sleepH + r.gauss(0.3);
    const dow = wakeDay.getDay(); // 0 Sun, 6 Sat: wake-ups after Fri/Sat nights out
    if (kind === 'weekend' && (dow === 0 || dow === 6)) {
      bedMin += 120;
      hours += 0.8;
    } else if (kind === 'exam' && i >= NIGHTS - 10) {
      bedMin += 150;
      hours -= 2.5;
    } else if (kind === 'improving') {
      bedMin -= 90 * (i / (NIGHTS - 1));
      hours += 2 * (i / (NIGHTS - 1));
    }
    const eff = Math.min(0.98, Math.max(0.75, 0.91 + r.gauss(0.03)));
    const asleep = Math.round(Math.max(180, hours * 60));
    const inBed = Math.round(asleep / eff);
    const bed = new Date(wakeDay);
    bed.setDate(bed.getDate() - 1);
    bed.setMinutes(Math.round(bedMin));
    const deep = Math.round(asleep * (0.14 + r.next() * 0.06));
    const rem = Math.round(asleep * (0.19 + r.next() * 0.06));
    out.push({
      day: localDay(wakeDay),
      bedtime: localIso(bed),
      wake_time: localIso(new Date(bed.getTime() + inBed * 60000)),
      duration_min: asleep,
      efficiency: Math.round((asleep / inBed) * 1000) / 1000,
      deep_min: deep,
      rem_min: rem,
      light_min: asleep - deep - rem,
      awake_min: inBed - asleep,
      source: 'mock',
    });
  }
  return out;
}

export const users: User[] = PROFILES.map(([name, squad], i) => ({
  id: i + 1,
  name,
  squad,
  source: 'mock',
  is_demo: true,
}));

/** Scored nights per user id, oldest first. `histories` is what GET /users/{id}/history returns. */
const scored: Record<number, Scored[]> = Object.fromEntries(
  PROFILES.map(([, , bedH, sleepH, kind], i) => [i + 1, scoreNights(genNights(i + 1, bedH, sleepH, kind))]),
);
export const histories: Record<number, HistoryNight[]> = Object.fromEntries(
  Object.entries(scored).map(([uid, s]) => [uid, s.map((x) => x.night)]),
);

/** Overview built from scored nights, same shape as GET /users/{id}/overview. */
export function overviewFor(user: User, nights: Scored[]): Overview {
  const last = nights[nights.length - 1];
  if (!last) return { user, history: [], streak_days: 0, best_streak: 0, badge: null };
  const { score, ...lastNight } = last.night;
  const p = last.parts;
  return {
    user,
    last_night: lastNight,
    score: {
      score,
      duration_pts: round1(p.d),
      consistency_pts: round1(p.c),
      quality_pts: round1(p.q),
      streak_pts: round1(p.s),
      streak_days: last.streak,
    },
    history: nights.slice(-7).map(({ night: n }) => ({
      day: n.day,
      score: n.score,
      bedtime: n.bedtime,
      wake_time: n.wake_time,
      duration_min: n.duration_min,
    })),
    streak_days: last.streak,
    best_streak: Math.max(...nights.map((x) => x.streak)),
    badge: badgeFor(last.streak),
  };
}

export const overviews: Record<number, Overview> = Object.fromEntries(
  users.map((u) => [u.id, overviewFor(u, scored[u.id])]),
);

/** Re-score after a manual log, so the mock overview reflects it like the backend would. */
export function rescore(userId: number, nights: Omit<HistoryNight, 'score'>[]) {
  scored[userId] = scoreNights(nights);
  histories[userId] = scored[userId].map((x) => x.night);
  const user = users.find((u) => u.id === userId);
  if (user) overviews[userId] = overviewFor(user, scored[userId]);
}

/** Weekly board (mock): average of each user's last 7 nights. */
export const leaderboard: LeaderboardEntry[] = users
  .map((u) => {
    const week = histories[u.id].slice(-7);
    return {
      user_id: u.id,
      name: u.name,
      squad: u.squad,
      score: round1(week.reduce((a, n) => a + n.score, 0) / week.length),
      streak_days: overviews[u.id].streak_days,
      badge: overviews[u.id].badge,
    };
  })
  .sort((a, b) => b.score - a.score)
  .map((e, i) => ({ ...e, rank: i + 1 }));
