/** A failed API call. `message` is the backend's human-readable reason, safe to show in the UI. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True when the user needs to log in (no token, expired token, or account gone). */
export const isAuthError = (e: unknown) => e instanceof ApiError && e.status === 401;
