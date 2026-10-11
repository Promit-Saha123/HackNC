import { mockClient } from './mockClient';
import { ApiError, type Api } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';

/** Bearer token from login/signup. Kept in memory, so a reload signs out. */
let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // FastAPI sends {detail: "..."} (or a list of validation errors for 422).
    const data = await res.json().catch(() => null);
    const detail = data?.detail;
    const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg : null;
    throw new ApiError(res.status, msg ?? `${res.status} ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);

const httpClient: Api = {
  users: () => get('/users'),
  overview: (userId) => get(`/users/${userId}/overview`),
  history: (userId, days = 60) => get(`/users/${userId}/history?days=${days}`),
  leaderboard: (period, squad) =>
    get(`/leaderboard?period=${period}${squad ? `&squad=${encodeURIComponent(squad)}` : ''}`),
  squadLeaderboard: (period) => get(`/leaderboard/squads?period=${period}`),
  friendCard: (userId) => get(`/users/${userId}/card`),
  briefing: (userId) => get(`/ai/briefing/${userId}`),
  insight: (userId) => get(`/ai/insight/${userId}`),

  login: (username, password) => post('/auth/login', { username, password }),
  signup: (username, password) => post('/auth/signup', { username, password }),
  me: () => get('/me'),
  updateMe: (update) => put('/me', update),
  changePassword: (current, next) => post('/me/password', { current_password: current, new_password: next }),
  deleteData: (userId) => request('DELETE', `/users/${userId}/data`),

  prefs: () => get('/me/prefs'),
  savePrefs: (prefs) => put('/me/prefs', prefs),
  logNight: (bed, wake) => post('/me/sleep', { bed, wake }),
  syncStatus: () => get('/me/sync'),
  ingestToken: () => post('/ingest/token'),

  mySquad: () => get('/me/squad'),
  createSquad: (name) => post('/me/squad', { name }),
  joinSquad: (code) => post('/me/squad/join', { code }),
  leaveSquad: () => post('/me/squad/leave'),
  squad: (code) => get(`/squads/${encodeURIComponent(code)}`),
};

/** Screens call `api.*`; flip EXPO_PUBLIC_USE_MOCKS to switch between fixtures and the backend. */
export const api: Api = USE_MOCKS ? mockClient : httpClient;
