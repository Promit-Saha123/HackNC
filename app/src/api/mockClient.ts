import { leaderboard, overviews, users } from './fixtures/data';
import type { Api } from './types';

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
};