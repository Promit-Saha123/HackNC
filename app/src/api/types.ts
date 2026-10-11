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
export type LoginResponse = Schemas['LoginResponse'];
export type Profile = Schemas['Profile'];
export type ProfileUpdate = Schemas['ProfileUpdate'];
export type Prefs = Schemas['Prefs'];
export type SleepNight = Schemas['SleepNight'];
export type HistoryNight = Schemas['HistoryNight'];
export type SquadInfo = Schemas['SquadInfo'];
export type SquadDetail = Schemas['SquadDetail'];
export type SquadMember = Schemas['SquadMember'];
export type FriendCard = Schemas['FriendCard'];
export type SyncStatus = Schemas['SyncStatus'];
export type IngestToken = Schemas['IngestToken'];

/** A failed request. `message` is the backend's `detail` when it sent one, so it can be shown as is. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Api {
  users(): Promise<User[]>;
  overview(userId: number): Promise<Overview>;
  /** The last `days` nights, oldest first, with times, stages and score. */
  history(userId: number, days?: number): Promise<HistoryNight[]>;
  leaderboard(period: Period, squad?: string): Promise<Leaderboard>;
  /** Squad vs squad: average member score. */
  squadLeaderboard(period: SquadPeriod): Promise<SquadLeaderboard>;
  /** What a friend sees: score + streak, plus bedtime and hours if they share details. */
  friendCard(userId: number): Promise<FriendCard>;
  briefing(userId: number): Promise<Briefing>;
  /** Weekly AI insight: the strongest pattern in the user's last 28 nights. */
  insight(userId: number): Promise<Insight>;

  // Accounts. Everything below needs the token from login/signup (see setToken).
  login(username: string, password: string): Promise<LoginResponse>;
  signup(username: string, password: string): Promise<LoginResponse>;
  me(): Promise<Profile>;
  updateMe(update: ProfileUpdate): Promise<Profile>;
  changePassword(current: string, next: string): Promise<void>;
  deleteData(userId: number): Promise<void>;

  // Goals, privacy, manual nights, sync.
  prefs(): Promise<Prefs>;
  savePrefs(prefs: Prefs): Promise<Prefs>;
  /** Device-local ISO times with no UTC offset, e.g. 2026-10-10T23:15:00. */
  logNight(bed: string, wake: string): Promise<SleepNight>;
  syncStatus(): Promise<SyncStatus>;
  /** Per-user key for the Shortcut's X-Ingest-Token header. */
  ingestToken(): Promise<IngestToken>;

  // Squads.
  mySquad(): Promise<SquadInfo | null>;
  createSquad(name: string): Promise<SquadInfo>;
  joinSquad(code: string): Promise<SquadInfo>;
  leaveSquad(): Promise<void>;
  squad(code: string): Promise<SquadDetail>;
}
