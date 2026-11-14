import { type DashboardToday } from '@pms/types';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
/** Live numbers for "today", for the properties the caller may see. Revenue, ADR and RevPAR belong to the analytics phase. */
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    today(propertyId: string | undefined, access: AccessContext): Promise<DashboardToday>;
}
