import type { CreateTaskInput, TaskActionInput, TasksQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { HousekeepingService } from './housekeeping.service';
export declare class HousekeepingController {
    private readonly housekeeping;
    constructor(housekeeping: HousekeepingService);
    list(propertyId: string, query: TasksQuery, access: AccessContext): Promise<import("@pms/types").HousekeepingTaskView[]>;
    staff(propertyId: string, access: AccessContext): Promise<import("@pms/types").AssignableStaff[]>;
    create(propertyId: string, dto: CreateTaskInput, access: AccessContext): Promise<import("@pms/types").HousekeepingTaskView>;
    generate(propertyId: string, access: AccessContext): Promise<{
        created: number;
    }>;
    /** Housekeepers start and finish their own tasks; supervisors do the rest. The service checks which. */
    action(id: string, dto: TaskActionInput, access: AccessContext): Promise<import("@pms/types").HousekeepingTaskView>;
}
