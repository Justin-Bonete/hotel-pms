import type { AnalyticsOverview } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** propertyId null = every property the person can see. */
export const useAnalytics = (propertyId: string | null, from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ['analytics-overview', propertyId ?? 'all', from, to],
    queryFn: () => api.get<AnalyticsOverview>(`/analytics/overview?from=${from}&to=${to}${propertyId ? `&propertyId=${propertyId}` : ''}`),
    enabled: enabled && Boolean(from) && Boolean(to) && from <= to,
    staleTime: 30_000,
  });

/** The browser's own calendar date, as YYYY-MM-DD. */
export const localToday = (): string => new Date().toLocaleDateString('en-CA');
