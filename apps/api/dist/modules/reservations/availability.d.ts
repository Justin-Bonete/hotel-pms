export interface StayDates {
    /** YYYY-MM-DD */
    arrivalDate: string;
    /** YYYY-MM-DD, the check-out day: that night is NOT occupied */
    departureDate: string;
}
/** For each night in [from, from + days): how many rooms of a type are still free. Pure, no database. */
export declare function nightlyAvailability(args: {
    totalRooms: number;
    reservations: readonly StayDates[];
    from: string;
    days: number;
}): Array<{
    date: string;
    available: number;
}>;
/** A stay can be booked only if EVERY one of its nights has a free room. */
export declare const canBook: (nights: ReadonlyArray<{
    available: number;
}>) => boolean;
