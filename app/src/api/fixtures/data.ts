import type { HistoryNight, LeaderboardEntry, Overview, User } from '../types';

const day = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

/** Local wall-clock ISO (no offset) for `minutes` after midnight, `daysAgo` days back. Negative minutes = the evening before. */
const at = (daysAgo: number, minutes: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, minutes, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

export const users: User[] = [
  { id: 1, name: 'Maya', squad: 'Wolfpack', source: 'mock', is_demo: true },
  { id: 2, name: 'Jordan', squad: 'Wolfpack', source: 'mock', is_demo: true },
  { id: 3, name: 'Riley', squad: 'Night Owls', source: 'mock', is_demo: true },
  { id: 4, name: 'Sam', squad: 'Night Owls', source: 'mock', is_demo: true },
];

export const squadCodes: Record<string, string> = { WOLF23: 'Wolfpack', OWLS42: 'Night Owls' };

type Shape = { scores: number[]; bed: number; hours: number; streak: number; best: number; badge: string | null };

/** 60 nights per user: the last 7 match `scores`, earlier ones wobble around the same pattern. */
function makeHistory(s: Shape): HistoryNight[] {
  return Array.from({ length: 60 }, (_, i) => {
    const ago = 59 - i;
    const wobble = Math.sin(i * 1.7) * 25; // minutes
    const recent = 7 - 1 - ago;
    const score = recent >= 0 ? s.scores[recent] : Math.max(30, Math.min(99, Math.round(avgOf(s.scores) + wobble / 3)));
    const asleep = Math.round(s.hours * 60 + wobble + (score - avgOf(s.scores)) * 2);
    const bed = s.bed + Math.round(wobble);
    const wake = bed + asleep + 25;
    return {
      day: day(ago),
      bedtime: at(ago, bed - 1440),
      wake_time: at(ago, wake - 1440),
      duration_min: asleep,
      efficiency: 0.92,
      deep_min: Math.round(asleep * 0.17),
      rem_min: Math.round(asleep * 0.23),
      light_min: asleep - Math.round(asleep * 0.4),
      awake_min: 25,
      source: 'mock',
      score,
    };
  });
}

function avgOf(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function makeOverview(user: User, nights: HistoryNight[], s: Shape): Overview {
  const last = nights[nights.length - 1];
  const { score: _score, ...lastNight } = last;
  return {
    user,
    last_night: lastNight,
    score: {
      score: last.score,
      duration_pts: 36,
      consistency_pts: 27,
      quality_pts: 18,
      streak_pts: Math.round(Math.min(s.streak / 14, 1) * 10),
      streak_days: s.streak,
    },
    history: nights.slice(-7).map((n) => ({
      day: n.day,
      score: n.score,
      bedtime: n.bedtime,
      wake_time: n.wake_time,
      duration_min: n.duration_min,
    })),
    streak_days: s.streak,
    best_streak: s.best,
    badge: s.badge,
  };
}

// Bedtimes are minutes after midnight on the evening before (1380 = 11:00 pm, 1500 = 1:00 am).
const SHAPES: Record<number, Shape> = {
  1: { scores: [92, 95, 97, 94, 96, 98, 97], bed: 1365, hours: 8.0, streak: 12, best: 21, badge: 'cloud' },
  2: { scores: [88, 71, 90, 85, 60, 74, 86], bed: 1410, hours: 7.3, streak: 2, best: 9, badge: null },
  3: { scores: [70, 68, 75, 72, 66, 71, 74], bed: 1500, hours: 6.6, streak: 0, best: 4, badge: null },
  4: { scores: [90, 44, 38, 52, 47, 60, 58], bed: 1440, hours: 5.4, streak: 0, best: 6, badge: null },
};

export const histories: Record<number, HistoryNight[]> = {};
export const overviews: Record<number, Overview> = {};
for (const u of users) {
  histories[u.id] = makeHistory(SHAPES[u.id]);
  overviews[u.id] = makeOverview(u, histories[u.id], SHAPES[u.id]);
}

/** Previous ranks so the arrows have something to show: Jordan and Sam swapped since yesterday. */
const PREV_RANK: Record<number, number> = { 1: 1, 2: 3, 3: 2, 4: 4 };

export const leaderboard: LeaderboardEntry[] = Object.values(overviews)
  .map((o) => ({
    user_id: o.user.id,
    name: o.user.name,
    squad: o.user.squad,
    score: o.score!.score,
    streak_days: o.streak_days,
    badge: o.badge,
    prev_rank: PREV_RANK[o.user.id] ?? null,
  }))
  .sort((a, b) => b.score - a.score)
  .map((e, i) => ({ ...e, rank: i + 1 }));
