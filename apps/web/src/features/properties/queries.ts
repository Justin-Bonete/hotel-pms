import type { PropertyDetail } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Full property record (timezone, currency...). Shares its cache key with the edit form. */
export function usePropertyDetail(id: string | undefined) {
  return useQuery({ queryKey: ['property', id], queryFn: () => api.get<PropertyDetail>(`/properties/${id}`), enabled: Boolean(id) });
}
