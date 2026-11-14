import { type AssignableStaff, type HousekeepingTaskView } from '@pms/types';
import type { CreateTaskInput, TaskActionInput, TasksQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { RealtimeService } from '../realtime/realtime.service';
export declare class HousekeepingService {
    private readonly prisma;
    private readonly audit;
    private readonly rbac;
    private readonly realtime;
    constructor(prisma: PrismaService, audit: AuditService, rbac: RbacService, realtime: RealtimeService);
    list(propertyId: string, query: TasksQuery, access: AccessContext): Promise<HousekeepingTaskView[]>;
    staff(propertyId: string, access: AccessContext): Promise<AssignableStaff[]>;
    create(propertyId: string, dto: CreateTaskInput, access: AccessContext): Promise<HousekeepingTaskView>;
    /**
     * One endpoint for the whole workflow. Supervisors assign, inspect and cancel; the housekeeper it is
     * assigned to starts and finishes it. A turnover clean also moves the ROOM along (dirty -> cleaning ->
     * clean -> available) so the front desk sees it live; a stayover never touches the room.
     */
    action(id: string, dto: TaskActionInput, access: AccessContext): Promise<HousekeepingTaskView>;
    /** Daily service for guests staying on: one STAYOVER task per in-house room not leaving today. Safe to run repeatedly. */
    generateStayovers(propertyId: string, access: AccessContext): Promise<{
        created: number;
    }>;
    private requireProperty;
    private requireAssignable;
}
