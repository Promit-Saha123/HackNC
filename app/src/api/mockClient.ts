import { histories, leaderboard, overviews, squadCodes, users } from './fixtures/data';
import {
  ApiError,
  type Api,
  type HistoryNight,
  type Insight,
  type LeaderboardEntry,
  type Prefs,
  type SquadEntry,
  type User,
} from './types';

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x: number) => Math.round(x * 10) / 10;

const DEMO_PASSWORD = 'sleepsquad';
const DEFAULT_PREFS: Prefs = { bedtime: 22 * 60 + 45, wake: 7 * 60, hours: 8, share_details: true, show_on_board: true };

// In-memory "server" state. Resets when the app reloads, like the backend's demo store.
let session: number | null = null;
const accounts: { user: User; password: string }[] = [];
const prefs: Record<number, Prefs> = {};
const squadOf: Record<number, string | null> = Object.fromEntries(users.map((u) => [u.id, u.squad ?? null]));
const manual: Record<number, HistoryNight[]> = {};

const allUsers = () => [...users, ...accounts.map((a) => a.user)];
const findUser = (id: number) => allUsers().find((u) => u.id === id);
const codeOf = (name: string) => Object.entries(squadCodes).find(([, n]) => n === name)?.[0] ?? '';
const prefsOf = (id: number) => prefs[id] ?? DEFAULT_PREFS;

function me(): number {
  if (session == null) throw new ApiError(401, 'Sign in first.');
  return session;
}

/** Board entries with the in-app squad changes and hidden users applied. */
function board(): LeaderboardEntry[] {
  return leaderboard
    .filter((e) => prefsOf(e.user_id).show_on_board)
    .map((e) => ({ ...e, squad: squadOf[e.user_id] ?? null }))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Most improved (mock): last 3 nights vs the 4 before; improvers only, like the backend. */
function improved(): LeaderboardEntry[] {
  return board()
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
  for (const e of board()) if (e.squad) (groups[e.squad] ??= []).push(e.score);
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

const overviewOf = (id: number) => {
  const user = findUser(id);
  const base = overviews[id] ?? overviews[1];
  return { ...base, user: user ? { ...user, squad: squadOf[id] ?? null } : base.user };
};

export const mockClient: Api = {
  users: async () => users,
  overview: async (userId) => overviewOf(userId),
  history: async (userId, days = 60) => {
    const byDay = new Map((histories[userId] ?? histories[1]).map((n) => [n.day, n]));
    for (const n of manual[userId] ?? []) byDay.set(n.day, n);
    return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-days);
  },
  leaderboard: async (period, squad) => ({
    period,
    squad: squad ?? null,
    entries: (period === 'improved' ? improved() : board()).filter((e) => !squad || e.squad === squad),
  }),
  squadLeaderboard: async (period) => ({ period, entries: squads() }),
  friendCard: async (userId) => {
    const o = overviewOf(userId);
    const p = prefsOf(userId);
    const recent = (histories[userId] ?? histories[1]).slice(-7);
    const bedMins = recent.map((n) => {
      const d = new Date(n.bedtime);
      return (d.getHours() * 60 + d.getMinutes() - 18 * 60 + 1440) % 1440; // since 6 pm, no midnight wrap
    });
    return {
      user_id: userId,
      name: o.user.name,
      squad: o.user.squad,
      score: o.score?.score ?? null,
      streak_days: o.streak_days,
      best_streak: o.best_streak,
      badge: o.badge,
      details: p.share_details
        ? {
            avg_bedtime: Math.round(avg(bedMins) + 18 * 60) % 1440,
            avg_hours: round1(avg(recent.map((n) => n.duration_min)) / 60),
          }
        : null,
    };
  },
  briefing: async (userId) => {
    const o = overviewOf(userId);
    const hours = ((o.last_night?.duration_min ?? 0) / 60).toFixed(1);
    return {
      user_id: userId,
      text:
        `Good morning, ${o.user.name}! You slept ${hours} hours and scored ${Math.round(o.score?.score ?? 0)}. ` +
        `Your streak is at ${o.streak_days} nights. Try heading to bed at your usual time tonight. ${NOTE}`,
      audio_url: null,
    };
  },
  insight: async (userId) => ({ user_id: userId, nights_used: 28, ...(INSIGHTS[userId] ?? INSIGHTS[1]) }),

  login: async (username, password) => {
    const who = username.trim().toLowerCase();
    const demo = users.find((u) => u.name.toLowerCase() === who);
    const acct = accounts.find((a) => a.user.name.toLowerCase() === who);
    const user = demo && password === DEMO_PASSWORD ? demo : acct && acct.password === password ? acct.user : null;
    if (!user) throw new ApiError(401, 'That username and password do not match.');
    session = user.id;
    return { user, token: `mock-${user.id}` };
  },
  signup: async (username, password) => {
    const name = username.trim();
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) throw new ApiError(422, 'Usernames are 3-24 letters, numbers, _ . or -.');
    if (password.length < 8) throw new ApiError(422, 'Use at least 8 characters.');
    if (allUsers().some((u) => u.name.toLowerCase() === name.toLowerCase()))
      throw new ApiError(409, 'An account with that username already exists. Log in instead.');
    const user: User = { id: 100 + accounts.length, name, squad: null, source: null, is_demo: false };
    accounts.push({ user, password });
    session = user.id;
    return { user, token: `mock-${user.id}` };
  },
  me: async () => {
    const id = me();
    const o = overviewOf(id);
    const h = histories[id] ?? histories[1];
    return {
      id,
      name: o.user.name,
      squad: squadOf[id] ?? null,
      is_demo: o.user.is_demo ?? true,
      member_since: `${h[0].day}T00:00:00`,
      stats: { nights: h.length, best_streak: o.best_streak, avg_score: round1(avg(h.slice(-30).map((n) => n.score))) },
    };
  },
  updateMe: async (update) => {
    const id = me();
    const acct = accounts.find((a) => a.user.id === id);
    if (!acct) throw new ApiError(403, "Demo profiles can't be edited.");
    if (update.name) acct.user = { ...acct.user, name: update.name.trim() };
    return mockClient.me();
  },
  changePassword: async (current, next) => {
    const acct = accounts.find((a) => a.user.id === me());
    if (!acct) throw new ApiError(403, "Demo profiles share a password and can't change it.");
    if (acct.password !== current) throw new ApiError(403, 'Your current password is wrong.');
    if (next.length < 8) throw new ApiError(422, 'Use at least 8 characters.');
    acct.password = next;
  },
  deleteData: async (userId) => {
    if (userId !== me()) throw new ApiError(403, 'You can only delete your own data.');
    const i = accounts.findIndex((a) => a.user.id === userId);
    if (i < 0) throw new ApiError(403, "Demo profiles can't be deleted.");
    accounts.splice(i, 1);
    session = null;
  },

  prefs: async () => prefsOf(me()),
  savePrefs: async (p) => {
    prefs[me()] = p;
    return p;
  },
  logNight: async (bed, wake) => {
    const id = me();
    const minutes = Math.round((new Date(wake).getTime() - new Date(bed).getTime()) / 60000);
    if (minutes < 60 || minutes > 16 * 60) throw new ApiError(422, 'A night must be between 1 and 16 hours.');
    const night = {
      day: wake.slice(0, 10),
      bedtime: bed,
      wake_time: wake,
      duration_min: minutes,
      efficiency: 0.9,
      deep_min: 0,
      rem_min: 0,
      light_min: minutes,
      awake_min: 0,
      source: 'manual',
    };
    manual[id] = [...(manual[id] ?? []).filter((n) => n.day !== night.day), { ...night, score: 75 }];
    return night;
  },
  syncStatus: async () => ({ connected: false, last_sync_at: null, nights_synced: 0 }),
  ingestToken: async () => ({ user_id: me(), token: `mock-ingest-${me()}` }),

  mySquad: async () => {
    const name = squadOf[me()];
    return name ? { name, code: codeOf(name) } : null;
  },
  createSquad: async (name) => {
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 30) throw new ApiError(422, 'Squad names are 2-30 characters.');
    if (Object.values(squadCodes).includes(clean)) throw new ApiError(409, 'That squad name is taken.');
    const code = `${clean.replace(/[^a-z]/gi, '').toUpperCase().padEnd(4, 'X').slice(0, 4)}${10 + Object.keys(squadCodes).length}`;
    squadCodes[code] = clean;
    squadOf[me()] = clean;
    return { name: clean, code };
  },
  joinSquad: async (code) => {
    const name = squadCodes[code.trim().toUpperCase()];
    if (!name) throw new ApiError(404, 'No squad with that code.');
    squadOf[me()] = name;
    return { name, code: code.trim().toUpperCase() };
  },
  leaveSquad: async () => {
    squadOf[me()] = null;
  },
  squad: async (code) => {
    const name = squadCodes[code.trim().toUpperCase()];
    if (!name) throw new ApiError(404, 'No squad with that code.');
    const members = allUsers()
      .filter((u) => squadOf[u.id] === name && prefsOf(u.id).show_on_board)
      .map((u) => ({ user_id: u.id, name: u.name, streak_days: overviews[u.id]?.streak_days ?? 0, badge: overviews[u.id]?.badge ?? null }));
    return { name, code: code.trim().toUpperCase(), members };
  },
};
