import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { api } from '@/api/client';
import type { LoginResponse, User } from '@/api/types';

type UserState = {
  userId: number;
  user: User | null;
  signedIn: boolean;
  /** Remember the user from /auth/login or /auth/signup (the API client keeps the token and signs every request). */
  signIn: (res: LoginResponse) => void;
  signOut: () => void;
  /** Bumped after anything that changes the user's data (a logged night, new goals, a squad), so screens refetch. */
  version: number;
  bump: () => void;
};

const UserContext = createContext<UserState>({
  userId: 0,
  user: null,
  signedIn: false,
  signIn: () => {},
  signOut: () => {},
  version: 0,
  bump: () => {},
});

/** Signed-in account. The token lives in memory only, so reloading the app signs out. */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [version, setVersion] = useState(0);

  const signIn = useCallback((res: LoginResponse) => {
    setUser(res.user);
  }, []);
  const signOut = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<UserState>(
    () => ({ userId: user?.id ?? 0, user, signedIn: !!user, signIn, signOut, version, bump }),
    [user, version, signIn, signOut, bump],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
