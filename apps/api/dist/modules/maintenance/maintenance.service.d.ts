import { type AssignableStaff, type MaintenanceTicketView } from '@pms/types';
import type { CreateTicketInput, TicketActionInput, TicketWorkInput, TicketsQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HousekeepingAutomation } from '../housekeeping/housekeeping-automation.service';
import { RbacService } from '../rbac/rbac.service';
import { RealtimeService } from '../realtime/realtime.service';
export declare class MaintenanceService {
    private readonly prisma;
    private readonly audit;
    private readonly rbac;
    private readonly realtime;
    private readonly housekeeping;
    constructor(prisma: PrismaService, audit: AuditService, rbac: RbacService, realtime: RealtimeService, housekeeping: HousekeepingAutomation);
    list(propertyId: string, query: TicketsQuery, access: AccessContext): Promise<MaintenanceTicketView[]>;
    staff(propertyId: string, access: AccessContext): Promise<AssignableStaff[]>;
    create(propertyId: string, dto: CreateTicketInput, access: AccessContext): Promise<MaintenanceTicketView>;
    action(id: string, dto: TicketActionInput, access: AccessContext): Promise<MaintenanceTicketView>;
    /** Log work done: cost (whole centavos), time, parts. Priority changes are for managers. */
    logWork(id: string, dto: TicketWorkInput, access: AccessContext): Promise<MaintenanceTicketView>;
    /** Hold the room out of service while it is repaired. Refuses if a guest is in it. Returns whether the room changed. */
    private blockRoom;
    /** Repair finished: if no other open ticket still holds the room, it needs cleaning before it can be sold. */
    private releaseRoom;
    private requireProperty;
}
