import { addDays } from '@pms/types';

export interface StayDates {
  /** YYYY-MM-DD */
  arrivalDate: string;
  /** YYYY-MM-DD, the check-out day: that night is NOT occupied */
  departureDate: string;
}

/** For each night in [from, from + days): how many rooms of a type are still free. Pure, no database. */
export function nightlyAvailability(args: {
  totalRooms: number;
  reservations: readonly StayDates[];
  from: string;
  days: number;
}): Array<{ date: string; available: number }> {
  const result: Array<{ date: string; available: number }> = [];
  for (let i = 0; i < args.days; i++) {
    const date = addDays(args.from, i);
    const taken = args.reservations.filter((r) => r.arrivalDate <= date && date < r.departureDate).length;
    result.push({ date, available: Math.max(args.totalRooms - taken, 0) });
  }
  return result;
}

/** A stay can be booked only if EVERY one of its nights has a free room. */
export const canBook = (nights: ReadonlyArray<{ available: number }>): boolean => nights.every((n) => n.available >= 1);
