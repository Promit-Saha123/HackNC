import { mockClient } from './mockClient';
import type { Api } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

const httpClient: Api = {
  users: () => get('/users'),
  overview: (userId) => get(`/users/${userId}/overview`),
  leaderboard: (period, squad) =>
    get(`/leaderboard?period=${period}${squad ? `&squad=${encodeURIComponent(squad)}` : ''}`),
  briefing: (userId) => get(`/ai/briefing/${userId}`),
  insight: (userId) => get(`/ai/insight/${userId}`),
};

/** Screens call `api.*`; flip EXPO_PUBLIC_USE_MOCKS to switch between fixtures and the backend. */
export const api: Api = USE_MOCKS ? mockClient : httpClient;