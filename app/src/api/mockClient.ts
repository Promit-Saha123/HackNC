import { leaderboard, overviews, users } from './fixtures/data';
import type { Api, Insight, LeaderboardEntry, SquadEntry } from './types';

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Most improved (mock): last 3 nights vs the 4 before; improvers only, like the backend. */
function improved(): LeaderboardEntry[] {
  return leaderboard
    .map((e) => {
      const h = overviews[e.user_id].history.map((n) => n.score);
      return { ...e, score: round1(avg(h.slice(-3))), delta: round1(avg(h.slice(-3)) - avg(h.slice(0, 4))) };
    })
    .filter((e) => e.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Squad vs squad (mock): average member score. */
function squads(): SquadEntry[] {
  const groups: Record<string, number[]> = {};
  for (const e of leaderboard) if (e.squad) (groups[e.squad] ??= []).push(e.score);
  return Object.entries(groups)
    .map(([squad, scores]) => ({ squad, score: round1(avg(scores)), members: scores.length }))
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

const NOTE = '(Just a friendly sleep summary, not medical advice.)';

// One example per insight kind, so every card state can be designed against mocks.
const INSIGHTS: Record<number, Pick<Insight, 'text' | 'kind'>> = {
  1: { kind: 'steady', text: `You've averaged 8.0 hours a night over your last 28 nights, and your bedtime usually stays within about 12 min. Steady wins streaks! ${NOTE}` },
  2: { kind: 'weekend', text: `On weekends you go to bed 2 h 4 min later than on weeknights, which costs you consistency points. Try keeping Friday within an hour of your usual bedtime. ${NOTE}` },
  3: { kind: 'bedtime', text: `You sleep 45 min more on nights you're in bed by midnight (18 of your last 28 nights). Try making midnight your cutoff tonight. ${NOTE}` },
  4: { kind: 'trend', text: `You slept 40 min less per night this week than last week. An earlier night or two could win it back. ${NOTE}` },
};

export const mockClient: Api = {
  users: async () => users,
  overview: async (userId) => overviews[userId] ?? overviews[1],
  leaderboard: async (period, squad) => ({
    period,
    squad: squad ?? null,
    entries: (period === 'improved' ? improved() : leaderboard).filter((e) => !squad || e.squad === squad),
  }),
  squadLeaderboard: async (period) => ({ period, entries: squads() }),
  briefing: async (userId) => {
    const o = overviews[userId] ?? overviews[1];
    const hours = ((o.last_night?.duration_min ?? 0) / 60).toFixed(1);
    return {
      user_id: userId,
      text:
        `Good morning, ${o.user.name}! You slept ${hours} hours and scored ${Math.round(o.score?.score ?? 0)}. ` +
        `Your streak is at ${o.streak_days} nights. Try heading to bed at your usual time tonight. ` +
        '(Just a friendly sleep summary, not medical advice.)',
      audio_url: null,
    };
  },
  insight: async (userId) => ({ user_id: userId, nights_used: 28, ...(INSIGHTS[userId] ?? INSIGHTS[1]) }),
};