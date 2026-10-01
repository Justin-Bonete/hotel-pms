'use client';

import type { AuthPayload, SessionUser } from '@pms/types';
import type { LoginInput, RegisterInput } from '@pms/validation';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, resetRefresh, tokenStore } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: SessionUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: Status; user: SessionUser | null }>({ status: 'loading', user: null });

  // On first load, try the httpOnly refresh cookie to restore the session.
  useEffect(() => {
    let alive = true;
    void refreshSession().then((payload) => {
      if (!alive) return;
      setState(payload ? { status: 'authenticated', user: payload.user } : { status: 'anonymous', user: null });
    });
    return () => {
      alive = false;
    };
  }, []);

  const adopt = useCallback((payload: AuthPayload) => {
    tokenStore.set(payload.accessToken);
    resetRefresh();
    setState({ status: 'authenticated', user: payload.user });
  }, []);

  const login = useCallback(async (input: LoginInput) => adopt(await api.post<AuthPayload>('/auth/login', input, false)), [adopt]);
  const register = useCallback(async (input: RegisterInput) => adopt(await api.post<AuthPayload>('/auth/register', input, false)), [adopt]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, false);
    } catch {
      // Signing out locally must always work, even if the server is unreachable.
    }
    tokenStore.set(null);
    resetRefresh();
    queryClient.clear();
    setState({ status: 'anonymous', user: null });
  }, [queryClient]);

  const value = useMemo(() => ({ ...state, login, register, logout }), [state, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
