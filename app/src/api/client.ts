import { ApiError } from './errors';
import { localIso } from './time';
import { mockClient } from './mockClient';
import type { Api, Briefing, ChatReply, LoginResponse, Transcript, User } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';

// Signed-in token, kept in memory: log in again after an app restart (no extra storage dependency).
let token: string | null = null;

/** Backend media paths (like `audio_url`) are relative; players need the full URL. */
export const absoluteUrl = (path: string) => (path.startsWith('http') ? path : `${BASE_URL}${path}`);

/** Auth header for requests the client doesn't make itself (e.g. the audio player fetching `audio_url`). */
export const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

/** The backend's reason: `detail` is a string for our errors, a list for validation (422) errors. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {}
  return `Request failed (${res.status})`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  const text = await res.text(); // 204s have no body
  return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T>(path: string) => request<T>('GET', path);

async function signIn(path: string, username: string, password: string) {
  const r = await request<LoginResponse>('POST', path, { username, password });
  token = r.token;
  return r;
}

const asLocal = (t: Date | string) => (typeof t === 'string' ? t : localIso(t));

const httpClient: Api = {
  users: () => get('/users'),
  overview: (userId) => get(`/users/${userId}/overview`),
  leaderboard: (period, squad) =>
    get(`/leaderboard?period=${period}${squad ? `&squad=${encodeURIComponent(squad)}` : ''}`),
  squadLeaderboard: (period) => get(`/leaderboard/squads?period=${period}`),
  briefing: async (userId) => {
    const b = await get<Briefing>(`/ai/briefing/${userId}`);
    return { ...b, audio_url: b.audio_url ? absoluteUrl(b.audio_url) : null };
  },
  insight: (userId) => get(`/ai/insight/${userId}`),

  login: (username, password) => signIn('/auth/login', username, password),
  signup: (username, password) => signIn('/auth/signup', username, password),
  logout: () => {
    token = null;
  },
  me: () => get('/auth/me'),

  history: (userId, days = 60) => get(`/users/${userId}/history?days=${days}`),

  profile: () => get('/me'),
  updateProfile: (update) => request('PUT', '/me', update),
  changePassword: (currentPassword, newPassword) =>
    request('POST', '/me/password', { current_password: currentPassword, new_password: newPassword }),
  prefs: () => get('/me/prefs'),
  savePrefs: (prefs) => request('PUT', '/me/prefs', prefs),
  logSleep: (bed, wake) => request('POST', '/me/sleep', { bed: asLocal(bed), wake: asLocal(wake) }),

  mySquad: () => get('/me/squad'),
  createSquad: (name) => request('POST', '/me/squad', { name }),
  joinSquad: (code) => request('POST', '/me/squad/join', { code }),
  leaveSquad: () => request('POST', '/me/squad/leave'),
  squad: (code) => get(`/squads/${encodeURIComponent(code.trim())}`),

  friendCard: (userId) => get(`/users/${userId}/card`),
  syncStatus: () => get('/me/sync'),
  ingestToken: () => request('POST', '/ingest/token'),
  deleteMyData: async () => {
    const me = await get<User>('/auth/me');
    await request('DELETE', `/users/${me.id}/data`);
    token = null; // the account no longer exists
  },

  chat: async (userId, messages, options) => {
    const r = await request<ChatReply>('POST', `/ai/chat/${userId}`, { messages, speak: !!options?.speak });
    return { ...r, audio_url: r.audio_url ? absoluteUrl(r.audio_url) : null };
  },
  transcribe: async (userId, fileUri) => {
    const audio = await (await fetch(fileUri)).blob(); // the recording on the phone
    const res = await fetch(`${BASE_URL}/ai/transcribe/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/mp4', ...authHeaders() },
      body: audio,
    });
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return (await res.json()) as Transcript;
  },
};

/** Screens call `api.*`; flip EXPO_PUBLIC_USE_MOCKS to switch between fixtures and the backend. */
export const api: Api = USE_MOCKS ? mockClient : httpClient;
export { ApiError, isAuthError } from './errors';
