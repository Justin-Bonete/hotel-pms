import type { BuildingView, RoomTypeView, RoomView } from '@pms/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const keys = {
  rooms: (propertyId: string) => ['rooms', propertyId] as const,
  roomTypes: (propertyId: string) => ['room-types', propertyId] as const,
  structure: (propertyId: string) => ['structure', propertyId] as const,
};

/** Loads up to 200 rooms of one property (a property is never thousands of rooms). Refreshes every 15 s. */
export function useRooms(propertyId: string) {
  return useQuery({
    queryKey: keys.rooms(propertyId),
    queryFn: async () => (await api.page<RoomView>(`/properties/${propertyId}/rooms?pageSize=200`)).data,
    refetchInterval: 15_000,
  });
}

export function useRoomTypes(propertyId: string) {
  return useQuery({ queryKey: keys.roomTypes(propertyId), queryFn: () => api.get<RoomTypeView[]>(`/properties/${propertyId}/room-types`) });
}

export function useStructure(propertyId: string) {
  return useQuery({ queryKey: keys.structure(propertyId), queryFn: () => api.get<BuildingView[]>(`/properties/${propertyId}/structure`) });
}

export function useRefreshRooms(propertyId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.rooms(propertyId) }),
      queryClient.invalidateQueries({ queryKey: keys.roomTypes(propertyId) }),
      queryClient.invalidateQueries({ queryKey: ['properties'] }),
    ]);
  };
}
