import { ApiError } from './errors';
import { histories, leaderboard, overviews, rescore, users } from './fixtures/data';
import { localIso } from './time';
import type { Api, Insight, LeaderboardEntry, Prefs, SleepNight, SquadEntry, SquadInfo, User } from './types';

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

// One example per insight kind (matching each demo friend's story), so every card state can be designed.
const INSIGHTS: Record<number, Pick<Insight, 'text' | 'kind'>> = {
  1: {
    kind: 'steady',
    text: `You've averaged 8.0 hours a night over your last 28 nights, and your bedtime usually stays within about 12 min. Steady wins streaks! ${NOTE}`,
  },
  2: {
    kind: 'weekend',
    text: `On weekends you go to bed 2 h 4 min later than on weeknights, which costs you consistency points. Try keeping Friday within an hour of your usual bedtime. ${NOTE}`,
  },
  3: {
    kind: 'bedtime',
    text: `You sleep 2 h 33 min more on nights you're in bed by midnight (18 of your last 28 nights). Try making midnight your cutoff tonight. ${NOTE}`,
  },
  5: {
    kind: 'trend',
    text: `You slept 22 min more per night this week than last week. Keep that rhythm going! ${NOTE}`,
  },
};

// --- In-memory "backend" for auth, prefs and manual logs: same rules and messages as the real API. ---
const DEMO_PASSWORD = 'sleepsquad';
const DEFAULT_PREFS: Prefs = { bedtime: 22 * 60 + 45, wake: 7 * 60, hours: 8, share_details: true, show_on_board: true };
const MANUAL_EFFICIENCY = 0.9; // same as backend/app/routes/me.py
const passwords: Record<number, string | null> = Object.fromEntries(users.map((u) => [u.id, null])); // null = demo
const prefsByUser: Record<number, Prefs> = {};
const profileExtras: Record<number, { avatar: string | null; bio: string | null }> = {};
let signedIn: number | null = null;

function currentUser(): User {
  const u = users.find((x) => x.id === signedIn);
  if (!u) throw new ApiError(401, 'missing or invalid token');
  return u;
}

function signInAs(u: User) {
  signedIn = u.id;
  return { user: u, token: `mock-token-${u.id}` };
}

const asLocal = (t: Date | string) => (typeof t === 'string' ? t : localIso(t));

// Squads: name -> invite code (same demo codes as the backend's DEMO_SQUAD_CODES).
const squadCodes: Record<string, string> = { Wolfpack: 'WOLF23', 'Night Owls': 'OWLS42', 'Library Rats': 'RATS17' };
const squadInfo = (name: string): SquadInfo => ({ name, code: squadCodes[name] });
const findSquadByCode = (code: string) => Object.keys(squadCodes).find((n) => squadCodes[n] === code.trim().toUpperCase());
/** 4 letters from the name + 2 digits, e.g. 'Study Buddies' -> STUD42 (same as the backend). */
function newCode(name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '').padEnd(4, 'X').slice(0, 4);
  let code: string;
  do {
    code = letters + String(10 + Math.floor(Math.random() * 90));
  } while (Object.values(squadCodes).includes(code));
  return code;
}
const prefsOf = (uid: number) => prefsByUser[uid] ?? DEFAULT_PREFS;

// Sync: Maya (id 1) shows a connected Shortcut so both Profile states can be designed against mocks.
const syncedAt: Record<number, string> = { 1: `${localIso(new Date()).slice(0, 10)}T07:32:00` };

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
        `Your streak is at ${o.streak_days} nights. Try heading to bed at your usual time tonight. ${NOTE}`,
      audio_url: null,
    };
  },
  insight: async (userId) => ({ user_id: userId, nights_used: 28, ...(INSIGHTS[userId] ?? INSIGHTS[1]) }),

  login: async (username, password) => {
    const u = users.find((x) => x.name.toLowerCase() === username.trim().toLowerCase());
    const stored = u ? passwords[u.id] : undefined;
    const ok = u && (stored === null ? password === DEMO_PASSWORD : password === stored);
    if (!u || !ok) throw new ApiError(401, 'That username and password do not match.');
    return signInAs(u);
  },
  signup: async (username, password) => {
    const me = users.find((x) => x.id === signedIn);
    if (me && !me.is_demo) {
      throw new ApiError(409, `You already have an account (${me.name}). Log out to create a different one.`);
    }
    const name = username.trim();
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(name)) {
      throw new ApiError(422, 'Usernames are 3-24 characters: letters, numbers, _ . -');
    }
    if (password.length < 8 || password.length > 128) throw new ApiError(422, 'Passwords are 8-128 characters.');
    if (users.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, 'An account with that username already exists. Log in instead.');
    }
    const u: User = { id: Math.max(0, ...users.map((x) => x.id)) + 1, name, squad: null, source: null, is_demo: false };
    users.push(u);
    passwords[u.id] = password;
    rescore(u.id, []);
    return signInAs(u);
  },
  logout: () => {
    signedIn = null;
  },
  me: async () => currentUser(),

  history: async (userId, days = 60) => (histories[userId] ?? []).slice(-days),

  profile: async () => {
    const u = currentUser();
    const nights = histories[u.id] ?? [];
    const recent = nights.slice(-30);
    return {
      id: u.id,
      name: u.name,
      squad: u.squad,
      is_demo: u.is_demo,
      avatar: profileExtras[u.id]?.avatar ?? null,
      bio: profileExtras[u.id]?.bio ?? null,
      member_since: nights[0]?.day ?? null,
      stats: {
        nights: nights.length,
        best_streak: overviews[u.id]?.best_streak ?? 0,
        avg_score: recent.length ? round1(avg(recent.map((n) => n.score))) : null,
      },
    };
  },
  updateProfile: async (update) => {
    const u = currentUser();
    if (u.is_demo) throw new ApiError(403, "demo profiles can't be edited");
    if (update.avatar && update.avatar.trim().length > 16) throw new ApiError(422, 'avatar must be at most 16 characters');
    if (update.bio && update.bio.trim().length > 160) throw new ApiError(422, 'bio must be at most 160 characters');
    if (update.name) u.name = update.name.trim();
    const prev = profileExtras[u.id];
    profileExtras[u.id] = {
      avatar: update.avatar === undefined ? (prev?.avatar ?? null) : update.avatar,
      bio: update.bio === undefined ? (prev?.bio ?? null) : update.bio,
    };
    return mockClient.profile();
  },
  changePassword: async (currentPassword, newPassword) => {
    const u = currentUser();
    if (u.is_demo) throw new ApiError(403, "demo profiles share a password and can't change it");
    if (currentPassword !== passwords[u.id]) throw new ApiError(403, 'Your current password is wrong.');
    if (newPassword.length < 8 || newPassword.length > 128) throw new ApiError(422, 'Passwords are 8-128 characters.');
    passwords[u.id] = newPassword;
  },
  prefs: async () => prefsByUser[currentUser().id] ?? DEFAULT_PREFS,
  savePrefs: async (prefs) => {
    const u = currentUser();
    const inRange = (m: number) => m >= 0 && m < 1440;
    if (!(inRange(prefs.bedtime) && inRange(prefs.wake) && prefs.hours >= 4 && prefs.hours <= 12)) {
      throw new ApiError(422, 'goal out of range');
    }
    prefsByUser[u.id] = { ...prefs };
    return prefsByUser[u.id];
  },
  logSleep: async (bed, wake) => {
    const u = currentUser();
    const bedIso = asLocal(bed);
    const wakeIso = asLocal(wake);
    const minutes = Math.floor((new Date(wakeIso).getTime() - new Date(bedIso).getTime()) / 60000);
    if (!(minutes >= 60 && minutes <= 16 * 60)) throw new ApiError(422, 'a night must be between 1 and 16 hours');
    const night: SleepNight = {
      day: wakeIso.slice(0, 10),
      bedtime: bedIso,
      wake_time: wakeIso,
      duration_min: minutes,
      efficiency: MANUAL_EFFICIENCY,
      deep_min: 0,
      rem_min: 0,
      light_min: minutes,
      awake_min: 0,
      source: 'manual',
    };
    // One night per wake date (a new entry replaces the old), then rescore like the backend.
    const others = (histories[u.id] ?? [])
      .filter((n) => n.day !== night.day)
      .map(({ score, ...n }) => n);
    rescore(u.id, [...others, night].sort((a, b) => a.day.localeCompare(b.day)));
    return night;
  },

  mySquad: async () => {
    const u = currentUser();
    return u.squad && squadCodes[u.squad] ? squadInfo(u.squad) : null;
  },
  createSquad: async (rawName) => {
    const u = currentUser();
    const name = rawName.trim();
    if (name.length < 2 || name.length > 30) throw new ApiError(422, 'squad name must be 2-30 characters');
    if (Object.keys(squadCodes).some((n) => n.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, 'that squad name is taken');
    }
    squadCodes[name] = newCode(name);
    u.squad = name;
    return squadInfo(name);
  },
  joinSquad: async (code) => {
    const u = currentUser();
    const name = findSquadByCode(code);
    if (!name) throw new ApiError(404, 'no squad with that code');
    u.squad = name;
    return squadInfo(name);
  },
  leaveSquad: async () => {
    currentUser().squad = null;
  },
  squad: async (code) => {
    const name = findSquadByCode(code);
    if (!name) throw new ApiError(404, 'no squad with that code');
    const members = users
      .filter((u) => u.squad?.toLowerCase() === name.toLowerCase() && prefsOf(u.id).show_on_board)
      .map((u) => ({ user_id: u.id, name: u.name, streak_days: overviews[u.id]?.streak_days ?? 0, badge: overviews[u.id]?.badge ?? null }));
    return { ...squadInfo(name), members };
  },

  friendCard: async (userId) => {
    const me = currentUser();
    const u = users.find((x) => x.id === userId);
    const o = overviews[userId];
    if (!u || !o || (!prefsOf(userId).show_on_board && me.id !== userId)) throw new ApiError(404, 'unknown user');
    const week = prefsOf(userId).share_details ? (histories[userId] ?? []).slice(-7) : [];
    // average bedtime counted from 18:00 so 23:30 and 00:30 average sensibly, then back to minutes after midnight
    const from18 = (iso: string) => {
      const d = new Date(iso);
      return (d.getHours() * 60 + d.getMinutes() - 18 * 60 + 1440) % 1440;
    };
    return {
      user_id: u.id,
      name: u.name,
      squad: u.squad,
      score: o.score?.score ?? null,
      streak_days: o.streak_days,
      best_streak: o.best_streak,
      badge: o.badge,
      avatar: profileExtras[u.id]?.avatar ?? null,
      bio: profileExtras[u.id]?.bio ?? null,
      details: week.length
        ? {
            avg_bedtime: Math.round((avg(week.map((n) => from18(n.bedtime))) + 18 * 60) % 1440),
            avg_hours: round1(avg(week.map((n) => n.duration_min)) / 60),
          }
        : null,
    };
  },
  syncStatus: async () => {
    const u = currentUser();
    const at = syncedAt[u.id] ?? null;
    return { connected: at !== null, last_sync_at: at, nights_synced: at ? (histories[u.id]?.length ?? 0) : 0 };
  },
  ingestToken: async () => {
    const u = currentUser();
    return { user_id: u.id, token: `mock-ingest-${u.id}` };
  },
  deleteMyData: async () => {
    const u = currentUser();
    if (u.is_demo) throw new ApiError(403, "demo profiles can't be deleted");
    // Like the backend: the whole account and its rows go, then the session ends.
    users.splice(users.indexOf(u), 1);
    delete histories[u.id];
    delete overviews[u.id];
    delete passwords[u.id];
    delete prefsByUser[u.id];
    delete profileExtras[u.id];
    delete syncedAt[u.id];
    signedIn = null;
  },

  transcribe: async () => {
    await new Promise((r) => setTimeout(r, 600));
    return { text: 'How can I climb the leaderboard?' }; // mock "heard" question
  },
  chat: async (userId, messages) => {
    await new Promise((r) => setTimeout(r, 700)); // feel like a real reply
    return mockSomni(userId, messages[messages.length - 1]?.text ?? '');
  },
};

// --- Mock Somni: keyword answers from the fixtures, with the same scope rules as the real one. ---
const SUGGESTIONS = ['Why did my score change?', "How's my streak going?", 'How can I climb the leaderboard?'];
const MEDICAL = /melatonin|insomnia|apnea|pill|medic|supplement|doctor|depress|anxiety|drug/i;
const SLEEP = /sleep|score|streak|badge|bed|wake|night|rank|leader|squad|beat|catch|goal|tired|nap|rest|week/i;

function mockSomni(userId: number, question: string) {
  const o = overviews[userId];
  if (MEDICAL.test(question)) {
    return {
      reply: "I can't help with medical questions or supplements. Please talk to a doctor or campus health about that.",
      suggestions: SUGGESTIONS,
      in_scope: false,
    };
  }
  if (!SLEEP.test(question) || !o) {
    return { reply: 'I can only help with your sleep and your Sleep Squad data.', suggestions: SUGGESTIONS, in_scope: false };
  }
  const s = o.score;
  const hours = ((o.last_night?.duration_min ?? 0) / 60).toFixed(1);
  let reply = `Last night you slept ${hours} hours and scored ${Math.round(s?.score ?? 0)}, and your streak is ${o.streak_days} nights.`;
  if (/rank|leader|beat|catch/i.test(question)) {
    const me = leaderboard.find((e) => e.user_id === userId);
    const ahead = me && leaderboard.find((e) => e.rank === me.rank - 1);
    reply = me
      ? `You're #${me.rank} this week with a ${Math.round(me.score)} average.` +
        (ahead ? ` ${ahead.name} is just ahead at ${Math.round(ahead.score)}, so a couple of full nights could close the gap.` : " You're in first, keep it up!")
      : "You're not on this week's board yet.";
  } else if (/streak|badge/i.test(question)) {
    reply = `Your streak is ${o.streak_days} nights (best ever ${o.best_streak}). A streak night is 7+ hours within an hour of your usual bedtime.`;
  } else if (/score|low|drop|why/i.test(question) && s) {
    reply = `You scored ${Math.round(s.score)}: duration ${Math.round(s.duration_pts)}/40, consistency ${Math.round(s.consistency_pts)}/30, quality ${Math.round(s.quality_pts)}/20 and streak ${Math.round(s.streak_pts)}/10.`;
  }
  return { reply, suggestions: SUGGESTIONS, in_scope: true };
}
