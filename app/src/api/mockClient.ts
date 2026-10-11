import { leaderboard, overviews, users } from './fixtures/data';
import type { Api, Insight } from './types';

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
    entries: leaderboard.filter((e) => !squad || e.squad === squad),
  }),
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