export { formatMoney } from '@pms/types';
export type { FolioItemView, PaymentView, ReservationView } from '@pms/types';
export const shortDateLabel = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
