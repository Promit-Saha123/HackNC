import type { LeaderboardEntry, Overview, User } from '../types';

const day = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

export const users: User[] = [
  { id: 1, name: 'Maya', squad: 'Wolfpack', source: 'mock', is_demo: true },
  { id: 2, name: 'Jordan', squad: 'Wolfpack', source: 'mock', is_demo: true },
  { id: 3, name: 'Riley', squad: 'Night Owls', source: 'mock', is_demo: true },
  { id: 4, name: 'Sam', squad: 'Night Owls', source: 'mock', is_demo: true },
];

function makeOverview(user: User, scores: number[], hours: number, streak: number, badge: string | null): Overview {
  const asleep = Math.round(hours * 60);
  return {
    user,
    last_night: {
      day: day(0),
      bedtime: `${day(1)}T23:10:00`,
      wake_time: `${day(0)}T07:00:00`,
      duration_min: asleep,
      efficiency: 0.92,
      deep_min: 70,
      rem_min: 95,
      light_min: asleep - 165,
      awake_min: 30,
      source: 'mock',
    },
    score: {
      score: scores[scores.length - 1],
      duration_pts: 36,
      consistency_pts: 27,
      quality_pts: 18,
      streak_pts: 7,
      streak_days: streak,
    },
    history: scores.map((score, i) => ({ day: day(scores.length - 1 - i), score })),
    streak_days: streak,
    badge,
  };
}

export const overviews: Record<number, Overview> = {
  1: makeOverview(users[0], [92, 95, 97, 94, 96, 98, 97], 8.0, 12, 'cloud'),
  2: makeOverview(users[1], [88, 71, 90, 85, 60, 74, 86], 7.3, 2, null),
  3: makeOverview(users[2], [70, 68, 75, 72, 66, 71, 74], 6.6, 0, null),
  4: makeOverview(users[3], [90, 44, 38, 52, 47, 60, 58], 5.4, 0, null),
};

export const leaderboard: LeaderboardEntry[] = Object.values(overviews)
  .map((o) => ({
    user_id: o.user.id,
    name: o.user.name,
    squad: o.user.squad,
    score: o.score!.score,
    streak_days: o.streak_days,
    badge: o.badge,
  }))
  .sort((a, b) => b.score - a.score)
  .map((e, i) => ({ ...e, rank: i + 1 }));