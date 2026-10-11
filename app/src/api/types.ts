import type { components } from './schema';

type Schemas = components['schemas'];

export type User = Schemas['User'];
export type Overview = Schemas['Overview'];
export type Leaderboard = Schemas['Leaderboard'];
export type LeaderboardEntry = Schemas['LeaderboardEntry'];
export type Briefing = Schemas['Briefing'];
export type Insight = Schemas['Insight'];
export type Period = Leaderboard['period']; // week | all | improved
export type SquadLeaderboard = Schemas['SquadLeaderboard'];
export type SquadEntry = Schemas['SquadEntry'];
export type SquadPeriod = SquadLeaderboard['period'];
export type SleepNight = Schemas['SleepNight'];
export type HistoryNight = Schemas['HistoryNight'];
export type LoginResponse = Schemas['LoginResponse'];
export type Profile = Schemas['Profile'];
export type ProfileUpdate = Schemas['ProfileUpdate'];
export type Prefs = Schemas['Prefs'];

export interface Api {
  users(): Promise<User[]>;
  overview(userId: number): Promise<Overview>;
  leaderboard(period: Period, squad?: string): Promise<Leaderboard>;
  /** Squad vs squad: average member score. */
  squadLeaderboard(period: SquadPeriod): Promise<SquadLeaderboard>;
  briefing(userId: number): Promise<Briefing>;
  /** Weekly AI insight: the strongest pattern in the user's last 28 nights. */
  insight(userId: number): Promise<Insight>;

  // --- Auth: login/signup keep the token in memory and send it on every later call. ---
  /** Demo profiles use the password `sleepsquad`. Throws ApiError(401) on a bad username/password. */
  login(username: string, password: string): Promise<LoginResponse>;
  /** Username 3-24 chars (letters, numbers, _ . -), password 8-128 chars. Throws ApiError(409/422) with a readable message. */
  signup(username: string, password: string): Promise<LoginResponse>;
  logout(): void;
  /** The signed-in user; throws ApiError(401) if not signed in (use isAuthError). */
  me(): Promise<User>;

  // --- History: powers Trends, Achievements and the calendar. ---
  /** The last `days` nights (default 60), oldest first, each with its score and stage minutes. */
  history(userId: number, days?: number): Promise<HistoryNight[]>;

  // --- Signed-in user's profile, goals and privacy. ---
  profile(): Promise<Profile>;
  updateProfile(update: ProfileUpdate): Promise<Profile>;
  /** Demo profiles share one password and can't change it (ApiError with a readable message). */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Goals (bedtime/wake in minutes after midnight, hours) and privacy toggles. */
  prefs(): Promise<Prefs>;
  savePrefs(prefs: Prefs): Promise<Prefs>;
  /** Log a night by hand. Pass Dates (sent as device-local time) or local ISO strings without an offset. */
  logSleep(bed: Date | string, wake: Date | string): Promise<SleepNight>;
}