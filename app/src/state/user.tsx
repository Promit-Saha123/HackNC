import { createContext, useContext, useState, type ReactNode } from 'react';

type UserState = { userId: number; setUserId: (id: number) => void };

const UserContext = createContext<UserState>({ userId: 1, setUserId: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(1);
  return <UserContext.Provider value={{ userId, setUserId }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);