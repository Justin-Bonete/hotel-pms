import type { AccessContext } from '../../common/access/access-context';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    /** Without propertyId: every property the caller can see. With it: that one property. */
    today(propertyId: string | undefined, access: AccessContext): Promise<import("@pms/types").DashboardToday>;
}
