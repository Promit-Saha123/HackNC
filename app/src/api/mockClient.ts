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
  briefing: async (userId) => ({
    user_id: userId,
    text: 'Good morning! (mock briefing) You slept well and your streak is alive.',
    audio_url: null,
  }),
};