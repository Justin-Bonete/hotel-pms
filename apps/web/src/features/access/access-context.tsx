'use client';

import type { AccessSummary, PermissionKey } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface AccessValue {
  isLoading: boolean;
  /** UI convenience only. The API enforces every rule again on the server. */
  can: (permission: PermissionKey, propertyId?: string) => boolean;
}

const AccessContext = createContext<AccessValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: ['rbac', 'me'], queryFn: () => api.get<AccessSummary>('/rbac/me'), staleTime: 60_000 });

  const can = useCallback(
    (permission: PermissionKey, propertyId?: string) => {
      const scope = query.data?.permissions[permission];
      if (!scope) return false;
      if (!propertyId) return true;
      return scope.all || scope.propertyIds.includes(propertyId);
    },
    [query.data],
  );

  const value = useMemo(() => ({ isLoading: query.isLoading, can }), [query.isLoading, can]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used inside <AccessProvider>');
  return ctx;
}
