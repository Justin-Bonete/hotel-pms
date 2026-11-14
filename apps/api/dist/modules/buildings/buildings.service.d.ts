import type { BuildingView } from '@pms/types';
import type { BuildingInput, FloorInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class BuildingsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    structure(propertyId: string, access: AccessContext): Promise<BuildingView[]>;
    addBuilding(propertyId: string, dto: BuildingInput, access: AccessContext): Promise<BuildingView>;
    addFloor(propertyId: string, buildingId: string, dto: FloorInput, access: AccessContext): Promise<{
        id: string;
        level: number;
        name: string | null;
    }>;
    private requireProperty;
}
