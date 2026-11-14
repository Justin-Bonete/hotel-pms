import type { PosMenuView, PosOrderView, PosSummaryView } from '@pms/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const usePosMenu = (propertyId: string, enabled = true) =>
  useQuery({ queryKey: ['pos-menu', propertyId], queryFn: () => api.get<PosMenuView>(`/properties/${propertyId}/pos/menu`), enabled });

export const usePosOrders = (propertyId: string, date: string, enabled = true) =>
  useQuery({ queryKey: ['pos-orders', propertyId, date], queryFn: () => api.get<PosOrderView[]>(`/properties/${propertyId}/pos/orders${date ? `?date=${date}` : ''}`), enabled });

export const usePosSummary = (propertyId: string, date: string, enabled = true) =>
  useQuery({ queryKey: ['pos-summary', propertyId, date], queryFn: () => api.get<PosSummaryView>(`/properties/${propertyId}/pos/summary${date ? `?date=${date}` : ''}`), enabled });

/** A sale touches the till, stock, and (for room charges) the guest's bill and the front desk. */
export function useRefreshPos() {
  const queryClient = useQueryClient();
  return () => Promise.all(['pos-menu', 'pos-orders', 'pos-summary', 'inventory', 'inventory-movements', 'folio', 'front-desk'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
}
