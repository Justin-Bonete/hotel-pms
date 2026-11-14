import { type RoomView } from '@pms/types';
import type { RoomInput, RoomStatusInput, RoomsQuery, UpdateRoomInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { Paginated } from '../../common/http/response.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
export declare class RoomsService {
    private readonly prisma;
    private readonly audit;
    private readonly realtime;
    constructor(prisma: PrismaService, audit: AuditService, realtime: RealtimeService);
    list(propertyId: string, query: RoomsQuery, access: AccessContext): Promise<Paginated<RoomView>>;
    create(propertyId: string, dto: RoomInput, access: AccessContext): Promise<RoomView>;
    update(id: string, dto: UpdateRoomInput, access: AccessContext): Promise<RoomView>;
    /** The housekeeping flow. Moving into or out of Out of order / Out of service needs room.manage. */
    changeStatus(id: string, dto: RoomStatusInput, access: AccessContext): Promise<RoomView>;
    /** Archive, never hard delete. (Phase 3 will also refuse while future reservations exist.) */
    archive(id: string, access: AccessContext): Promise<void>;
    private requireProperty;
    private ensureNumberFree;
    /** Room type and floor must belong to the SAME property as the room. */
    private checkRefs;
}
