import { type AvailabilityView, type CalendarView, type ReservationView } from '@pms/types';
import type { CreateReservationInput, ExtendStayInput, RangeQuery, ReservationsQuery, TransitionInput, UpdateReservationInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { Paginated } from '../../common/http/response.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FolioLedger } from '../folios/folio-ledger.service';
import { HousekeepingAutomation } from '../housekeeping/housekeeping-automation.service';
import { RealtimeService } from '../realtime/realtime.service';
export declare class ReservationsService {
    private readonly prisma;
    private readonly audit;
    private readonly ledger;
    private readonly realtime;
    private readonly housekeeping;
    constructor(prisma: PrismaService, audit: AuditService, ledger: FolioLedger, realtime: RealtimeService, housekeeping: HousekeepingAutomation);
    list(query: ReservationsQuery, access: AccessContext): Promise<Paginated<ReservationView>>;
    get(id: string, access: AccessContext): Promise<ReservationView>;
    calendar(propertyId: string, query: RangeQuery, access: AccessContext): Promise<CalendarView>;
    availability(propertyId: string, query: RangeQuery, access: AccessContext): Promise<AvailabilityView>;
    create(propertyId: string, dto: CreateReservationInput, access: AccessContext): Promise<ReservationView>;
    update(id: string, dto: UpdateReservationInput, access: AccessContext): Promise<ReservationView>;
    /** An in-house guest stays longer. The room must be free, the extra nights are priced from the rate plan and billed to the folio. */
    extend(id: string, dto: ExtendStayInput, access: AccessContext): Promise<ReservationView>;
    transition(id: string, dto: TransitionInput, access: AccessContext): Promise<ReservationView>;
    private stayForBilling;
    private requireProperty;
    private roomTypeCapacity;
    /** The rate plan (given, or the property's default) must have a rate for this room type. */
    private resolveQuote;
    private resolveGuest;
    /**
     * Room-type inventory: every night of the stay needs at least one free room. A per-room-type advisory
     * lock makes two simultaneous bookings take turns, so the last room can't be sold twice.
     */
    private ensureAvailability;
    private ensureRoomFree;
    private validateRoom;
    private assertRoomReady;
    private newCode;
}
