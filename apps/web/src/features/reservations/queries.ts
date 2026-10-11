import type { AvailabilityView, CalendarView, GuestDetail, GuestView, RatePlanView, ReservationView } from '@pms/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useReservations(params: { propertyId?: string; status?: string; search?: string; page: number }) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: '25' });
  if (params.propertyId) qs.set('propertyId', params.propertyId);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return useQuery({ queryKey: ['reservations', qs.toString()], queryFn: () => api.page<ReservationView>(`/reservations?${qs}`) });
}

export function useReservation(id: string | null) {
  return useQuery({ queryKey: ['reservation', id], queryFn: () => api.get<ReservationView>(`/reservations/${id}`), enabled: Boolean(id) });
}

export function useCalendar(propertyId: string, from: string, days: number) {
  return useQuery({
    queryKey: ['calendar', propertyId, from, days],
    queryFn: () => api.get<CalendarView>(`/properties/${propertyId}/calendar?from=${from}&days=${days}`),
    refetchInterval: 30_000,
  });
}

export function useAvailability(propertyId: string, from: string, days: number) {
  return useQuery({
    queryKey: ['availability', propertyId, from, days],
    queryFn: () => api.get<AvailabilityView>(`/properties/${propertyId}/availability?from=${from}&days=${days}`),
  });
}

export function useRatePlans(propertyId: string, enabled = true) {
  return useQuery({ queryKey: ['rate-plans', propertyId], queryFn: () => api.get<RatePlanView[]>(`/properties/${propertyId}/rate-plans`), enabled });
}

export function useGuests(search: string, page: number, enabled = true) {
  const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search.trim()) qs.set('search', search.trim());
  return useQuery({ queryKey: ['guests', qs.toString()], queryFn: () => api.page<GuestView>(`/guests?${qs}`), enabled });
}

export function useGuest(id: string | null) {
  return useQuery({ queryKey: ['guest', id], queryFn: () => api.get<GuestDetail>(`/guests/${id}`), enabled: Boolean(id) });
}

/** Everything that depends on reservations: lists, calendar, availability, and room tiles (derived status). */
export function useRefreshReservations() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['reservations', 'reservation', 'calendar', 'availability', 'rooms', 'guests', 'guest', 'folio'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
}
