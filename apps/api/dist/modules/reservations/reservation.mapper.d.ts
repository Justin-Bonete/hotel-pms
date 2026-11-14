import type { Prisma } from '@prisma/client';
import { type ReservationView } from '@pms/types';
export declare const reservationInclude: {
    property: {
        select: {
            name: true;
        };
    };
    guest: {
        select: {
            firstName: true;
            lastName: true;
        };
    };
    roomType: {
        select: {
            name: true;
        };
    };
    room: {
        select: {
            number: true;
        };
    };
    ratePlan: {
        select: {
            name: true;
        };
    };
};
/** Same as reservationInclude, plus the property's timezone (needed for "today" rules). */
export declare const reservationDetailInclude: {
    property: {
        select: {
            name: true;
            timezone: true;
        };
    };
    guest: {
        select: {
            firstName: true;
            lastName: true;
        };
    };
    roomType: {
        select: {
            name: true;
        };
    };
    room: {
        select: {
            number: true;
        };
    };
    ratePlan: {
        select: {
            name: true;
        };
    };
};
export type ReservationRow = Prisma.ReservationGetPayload<{
    include: typeof reservationInclude;
}>;
export declare const toReservationView: (r: ReservationRow) => ReservationView;
