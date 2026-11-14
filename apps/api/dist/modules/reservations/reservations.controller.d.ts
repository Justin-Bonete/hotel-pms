import type { CreateReservationInput, ExtendStayInput, RangeQuery, ReservationsQuery, TransitionInput, UpdateReservationInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ReservationsService } from './reservations.service';
export declare class ReservationsController {
    private readonly reservations;
    constructor(reservations: ReservationsService);
    list(query: ReservationsQuery, access: AccessContext): Promise<import("../../common/http/response.interceptor").Paginated<import("@pms/types").ReservationView>>;
    get(id: string, access: AccessContext): Promise<import("@pms/types").ReservationView>;
    create(propertyId: string, dto: CreateReservationInput, access: AccessContext): Promise<import("@pms/types").ReservationView>;
    update(id: string, dto: UpdateReservationInput, access: AccessContext): Promise<import("@pms/types").ReservationView>;
    /** Needs reservation.manage OR reservation.check_in depending on the action; the service checks the exact one. */
    transition(id: string, dto: TransitionInput, access: AccessContext): Promise<import("@pms/types").ReservationView>;
    extend(id: string, dto: ExtendStayInput, access: AccessContext): Promise<import("@pms/types").ReservationView>;
    calendar(propertyId: string, query: RangeQuery, access: AccessContext): Promise<import("@pms/types").CalendarView>;
    availability(propertyId: string, query: RangeQuery, access: AccessContext): Promise<import("@pms/types").AvailabilityView>;
}
