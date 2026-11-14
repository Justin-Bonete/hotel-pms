import type { CreateTicketInput, TicketActionInput, TicketWorkInput, TicketsQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { MaintenanceService } from './maintenance.service';
export declare class MaintenanceController {
    private readonly maintenance;
    constructor(maintenance: MaintenanceService);
    list(propertyId: string, query: TicketsQuery, access: AccessContext): Promise<import("@pms/types").MaintenanceTicketView[]>;
    staff(propertyId: string, access: AccessContext): Promise<import("@pms/types").AssignableStaff[]>;
    create(propertyId: string, dto: CreateTicketInput, access: AccessContext): Promise<import("@pms/types").MaintenanceTicketView>;
    action(id: string, dto: TicketActionInput, access: AccessContext): Promise<import("@pms/types").MaintenanceTicketView>;
    logWork(id: string, dto: TicketWorkInput, access: AccessContext): Promise<import("@pms/types").MaintenanceTicketView>;
}
