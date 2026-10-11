import { createContext, useContext, useState, type ReactNode } from 'react';

type UserState = {
  userId: number;
  setUserId: (id: number) => void;
  /** Hard-coded demo login for now: no tokens, resets when the app reloads. */
  signedIn: boolean;
  signIn: (id: number) => void;
  signOut: () => void;
};

const UserContext = createContext<UserState>({
  userId: 1,
  setUserId: () => {},
  signedIn: false,
  signIn: () => {},
  signOut: () => {},
});

// TODO(P1): swap for real auth (hashed passwords on the backend, token on the phone).
export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(1);
  const [signedIn, setSignedIn] = useState(false);
  const signIn = (id: number) => {
    setUserId(id);
    setSignedIn(true);
  };
  return (
    <UserContext.Provider value={{ userId, setUserId, signedIn, signIn, signOut: () => setSignedIn(false) }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
