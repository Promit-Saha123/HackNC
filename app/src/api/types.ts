import type { components } from './schema';

type Schemas = components['schemas'];

export type User = Schemas['User'];
export type Overview = Schemas['Overview'];
export type Leaderboard = Schemas['Leaderboard'];
export type LeaderboardEntry = Schemas['LeaderboardEntry'];
export type Briefing = Schemas['Briefing'];
export type Insight = Schemas['Insight'];
export type Period = Leaderboard['period'];

export interface Api {
  users(): Promise<User[]>;
  overview(userId: number): Promise<Overview>;
  leaderboard(period: Period, squad?: string): Promise<Leaderboard>;
  briefing(userId: number): Promise<Briefing>;
  /** Weekly AI insight: the strongest pattern in the user's last 28 nights. */
  insight(userId: number): Promise<Insight>;
}