import type { RoomStatus } from '@pms/types';

export const STATUS_META: Record<RoomStatus, { label: string; tile: string; dot: string }> = {
  AVAILABLE: { label: 'Available', tile: 'bg-emerald-50 ring-emerald-200 text-emerald-900', dot: 'bg-emerald-500' },
  DIRTY: { label: 'Dirty', tile: 'bg-amber-50 ring-amber-200 text-amber-900', dot: 'bg-amber-500' },
  CLEANING: { label: 'Cleaning', tile: 'bg-sky-50 ring-sky-200 text-sky-900', dot: 'bg-sky-500' },
  INSPECTED: { label: 'Inspected', tile: 'bg-teal-50 ring-teal-200 text-teal-900', dot: 'bg-teal-500' },
  MAINTENANCE: { label: 'Maintenance', tile: 'bg-orange-50 ring-orange-200 text-orange-900', dot: 'bg-orange-500' },
  OUT_OF_ORDER: { label: 'Out of order', tile: 'bg-red-50 ring-red-200 text-red-900', dot: 'bg-red-500' },
  OUT_OF_SERVICE: { label: 'Out of service', tile: 'bg-slate-100 ring-slate-300 text-slate-700', dot: 'bg-slate-500' },
};

/** Compare "101", "2A", "V03" the way people expect (numeric parts in order). */
export const compareRoomNumbers = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true });
