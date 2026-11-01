import type { AssignableStaff, FrontDeskView, HousekeepingTaskView, MaintenanceTicketView } from '@pms/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useFrontDesk = (propertyId: string) =>
  useQuery({ queryKey: ['front-desk', propertyId], queryFn: () => api.get<FrontDeskView>(`/properties/${propertyId}/front-desk`), refetchInterval: 60_000 });

export const useTasks = (propertyId: string, mine: boolean, enabled = true) =>
  useQuery({
    queryKey: ['housekeeping', propertyId, mine ? 'mine' : 'all'],
    queryFn: () => api.get<HousekeepingTaskView[]>(`/properties/${propertyId}/housekeeping/tasks?open=true${mine ? '&mine=true' : ''}`),
    enabled,
    refetchInterval: 60_000,
  });

export const useHousekeepingStaff = (propertyId: string, enabled: boolean) =>
  useQuery({ queryKey: ['housekeeping-staff', propertyId], queryFn: () => api.get<AssignableStaff[]>(`/properties/${propertyId}/housekeeping/staff`), enabled });

export const useTickets = (propertyId: string, openOnly: boolean, enabled = true) =>
  useQuery({
    queryKey: ['maintenance', propertyId, openOnly ? 'open' : 'all'],
    queryFn: () => api.get<MaintenanceTicketView[]>(`/properties/${propertyId}/maintenance/tickets${openOnly ? '?open=true' : ''}`),
    enabled,
    refetchInterval: 60_000,
  });

export const useMaintenanceStaff = (propertyId: string, enabled: boolean) =>
  useQuery({ queryKey: ['maintenance-staff', propertyId], queryFn: () => api.get<AssignableStaff[]>(`/properties/${propertyId}/maintenance/staff`), enabled });

/** After any operations change: tasks, tickets, room tiles, front desk and calendar all depend on it. */
export function useRefreshOps() {
  const queryClient = useQueryClient();
  return () => Promise.all(['housekeeping', 'maintenance', 'rooms', 'front-desk', 'calendar', 'reservations', 'reservation'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
}
