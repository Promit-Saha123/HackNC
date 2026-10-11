import { createContext, useContext, useState, type ReactNode } from 'react';

/** An account made on the Create account screen. Kept in memory only until the backend has real auth. */
export type LocalAccount = { name: string; username: string; email: string; password: string };

type UserState = {
  userId: number;
  setUserId: (id: number) => void;
  /** Hard-coded demo login for now: no tokens, resets when the app reloads. */
  signedIn: boolean;
  signIn: (id: number) => void;
  signOut: () => void;
  accounts: LocalAccount[];
  addAccount: (a: LocalAccount) => void;
};

const UserContext = createContext<UserState>({
  userId: 1,
  setUserId: () => {},
  signedIn: false,
  signIn: () => {},
  signOut: () => {},
  accounts: [],
  addAccount: () => {},
});

// TODO(P1): swap for real auth (hashed passwords on the backend, token on the phone).
export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(1);
  const [signedIn, setSignedIn] = useState(false);
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const signIn = (id: number) => {
    setUserId(id);
    setSignedIn(true);
  };
  return (
    <UserContext.Provider
      value={{
        userId,
        setUserId,
        signedIn,
        signIn,
        signOut: () => setSignedIn(false),
        accounts,
        addAccount: (a) => setAccounts((prev) => [...prev, a]),
      }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
