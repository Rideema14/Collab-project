'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthToken, setUnauthorizedHandler } from './api/client';
import { authApi } from './api/endpoints';
import type { AuthUser } from './types';

const STORAGE_KEY = 'kuberya.auth';

interface StoredAuth {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** 'loading' only until we've read localStorage — it prevents an auth-flash on refresh. */
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    // Corrupt or unavailable storage — treat as signed out rather than crashing.
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const startSession = useCallback((payload: StoredAuth) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setAuthToken(payload.token);
    setUser(payload.user);
    setStatus('authenticated');
  }, []);

  // Restore the session on first paint.
  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setAuthToken(stored.token);
      setUser(stored.user);
      setStatus('authenticated');
    } else {
      setStatus('anonymous');
    }
  }, []);

  /*
   * The JWT is signed with a 7d expiry, so a stored token can be accepted by
   * this app but rejected by the server. When any request comes back 401, drop
   * the session and bounce to /login rather than leaving the user staring at a
   * screen that silently fails to load.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      router.replace('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await authApi.login({ email, password });
      startSession(payload);
    },
    [startSession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const payload = await authApi.register({ name, email, password });
      startSession(payload);
    },
    [startSession]
  );

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [clearSession, router]);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
