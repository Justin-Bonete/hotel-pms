import type { ReservationStatus } from '@pms/types';

export const RESERVATION_META: Record<ReservationStatus, { label: string; badge: string; bar: string }> = {
  INQUIRY: { label: 'Inquiry', badge: 'bg-slate-100 text-slate-700', bar: 'bg-slate-300 text-slate-900' },
  PENDING: { label: 'Pending', badge: 'bg-amber-50 text-amber-800', bar: 'bg-amber-300 text-amber-950' },
  CONFIRMED: { label: 'Confirmed', badge: 'bg-indigo-50 text-indigo-700', bar: 'bg-indigo-500 text-white' },
  CHECKED_IN: { label: 'Checked in', badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500 text-white' },
  CHECKED_OUT: { label: 'Checked out', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400 text-white' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-red-50 text-red-700', bar: 'bg-red-300 text-red-950' },
  NO_SHOW: { label: 'No-show', badge: 'bg-orange-50 text-orange-800', bar: 'bg-orange-300 text-orange-950' },
};

export const SOURCE_LABELS: Record<string, string> = {
  WALK_IN: 'Walk-in', PHONE: 'Phone', WEBSITE: 'Website', OTA: 'OTA', GROUP: 'Group', CORPORATE: 'Corporate', TRAVEL_AGENT: 'Travel agent', OTHER: 'Other',
};

export const shortDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
