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
export type SquadInfo = Schemas['SquadInfo'];
export type SquadDetail = Schemas['SquadDetail'];
export type SquadMember = Schemas['SquadMember'];
export type FriendCard = Schemas['FriendCard'];
export type SyncStatus = Schemas['SyncStatus'];
export type IngestToken = Schemas['IngestToken'];

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

  // --- Squads (signed-in user). Invite codes look like WOLF23. ---
  /** The user's squad, or null if they aren't in one. */
  mySquad(): Promise<SquadInfo | null>;
  /** Creates a squad (2-30 chars) and joins it. 409 if the name is taken. */
  createSquad(name: string): Promise<SquadInfo>;
  /** Joins by invite code (case-insensitive). 404 "no squad with that code". */
  joinSquad(code: string): Promise<SquadInfo>;
  leaveSquad(): Promise<void>;
  /** Squad name, code and members (score-level info only; members hidden from the board are left out). */
  squad(code: string): Promise<SquadDetail>;

  // --- Friends, sync and privacy. ---
  /** Friend card: score + streak always; `details` (avg bedtime/hours) only if that friend shares them. */
  friendCard(userId: number): Promise<FriendCard>;
  /** Apple Health row on Profile: has the Shortcut synced, when, and how many nights. */
  syncStatus(): Promise<SyncStatus>;
  /** Per-user token for the Shortcut's X-Ingest-Token header. */
  ingestToken(): Promise<IngestToken>;
  /**
   * Privacy: permanently deletes the signed-in ACCOUNT and all its data (nights, scores, prefs), then signs out.
   * Real accounts only: demo profiles get a readable 403, so only show the button when `user.is_demo` is false,
   * behind an "are you sure?" confirmation.
   */
  deleteMyData(): Promise<void>;
}