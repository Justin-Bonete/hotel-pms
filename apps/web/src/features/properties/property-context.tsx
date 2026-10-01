'use client';

import type { PropertySummary } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';

export const ALL_PROPERTIES = 'ALL';
const STORAGE_KEY = 'pms.selectedProperty';

interface PropertyContextValue {
  properties: PropertySummary[];
  isLoading: boolean;
  error: Error | null;
  /** 'ALL' or a property id. Later steps send this as the X-Property-Id header. */
  selectedId: string;
  selected: PropertySummary | null;
  select: (id: string) => void;
  refetch: () => void;
}

const PropertyContext = createContext<PropertyContextValue | null>(null);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string>(ALL_PROPERTIES);
  const query = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.page<PropertySummary>('/properties?pageSize=100'),
  });
  const properties = useMemo(() => query.data?.data ?? [], [query.data]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedId(stored);
    } catch {
      /* storage unavailable: default to all properties */
    }
  }, []);

  // A remembered property that no longer exists falls back to "All properties".
  useEffect(() => {
    if (query.data && selectedId !== ALL_PROPERTIES && !properties.some((p) => p.id === selectedId)) {
      setSelectedId(ALL_PROPERTIES);
    }
  }, [query.data, properties, selectedId]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<PropertyContextValue>(
    () => ({
      properties,
      isLoading: query.isLoading,
      error: query.error,
      selectedId,
      selected: properties.find((p) => p.id === selectedId) ?? null,
      select,
      refetch: () => void query.refetch(),
    }),
    [properties, query, selectedId, select],
  );
  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}

export function useProperties(): PropertyContextValue {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error('useProperties must be used inside <PropertyProvider>');
  return ctx;
}
