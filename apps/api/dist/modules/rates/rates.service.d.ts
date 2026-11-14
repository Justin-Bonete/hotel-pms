import type { RatePlanView } from '@pms/types';
import type { RatePlanInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class RatesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(propertyId: string, access: AccessContext): Promise<RatePlanView[]>;
    create(propertyId: string, dto: RatePlanInput, access: AccessContext): Promise<RatePlanView>;
    /** Replaces the plan's name, description, default flag and ALL its rates. */
    update(id: string, dto: RatePlanInput, access: AccessContext): Promise<RatePlanView>;
    archive(id: string, access: AccessContext): Promise<void>;
    private requireProperty;
    private checkRoomTypes;
    private ensureNameFree;
}
