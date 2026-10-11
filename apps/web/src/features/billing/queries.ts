import type { FolioView, TaxView } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useFolio(reservationId: string, enabled: boolean) {
  return useQuery({ queryKey: ['folio', reservationId], queryFn: () => api.get<FolioView>(`/reservations/${reservationId}/folio`), enabled });
}

export function useTaxes(propertyId: string, enabled = true) {
  return useQuery({ queryKey: ['taxes', propertyId], queryFn: () => api.get<TaxView[]>(`/properties/${propertyId}/taxes`), enabled });
}
