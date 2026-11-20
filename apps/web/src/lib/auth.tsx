import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, refreshSession, setSession, subscribeSession } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    subscribeSession(setUserState);
    // Restore the session from the refresh cookie on page load.
    refreshSession().finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setSession(res.accessToken, res.user);
    return res.user;
  }, []);

  const register = useCallback(async (body: Record<string, unknown>) => {
    const res = await api<{ accessToken: string; user: User }>('/auth/register', {
      method: 'POST',
      body,
    });
    setSession(res.accessToken, res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setSession(null, null);
    qc.clear();
  }, [qc]);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, setUser: setUserState }),
    [user, ready, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
