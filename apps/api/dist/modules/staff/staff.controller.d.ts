import type { InviteStaffInput, ScopeInput, StaffQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { StaffService } from './staff.service';
export declare class StaffController {
    private readonly staff;
    constructor(staff: StaffService);
    list(query: StaffQuery, access: AccessContext): Promise<import("../../common/http/response.interceptor").Paginated<import("@pms/types").StaffView>>;
    invite(dto: InviteStaffInput, access: AccessContext): Promise<import("@pms/types").StaffView>;
    resend(id: string, access: AccessContext): Promise<{
        message: string;
    }>;
    add(id: string, dto: ScopeInput, access: AccessContext): Promise<import("@pms/types").StaffView>;
    remove(id: string, assignmentId: string, access: AccessContext): Promise<import("@pms/types").StaffView>;
    disable(id: string, access: AccessContext): Promise<import("@pms/types").StaffView>;
    enable(id: string, access: AccessContext): Promise<import("@pms/types").StaffView>;
}
