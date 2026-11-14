import type { RoomTypeView } from '@pms/types';
import type { RoomTypeInput, UpdateRoomTypeInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class RoomTypesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(propertyId: string, access: AccessContext): Promise<RoomTypeView[]>;
    create(propertyId: string, dto: RoomTypeInput, access: AccessContext): Promise<RoomTypeView>;
    update(id: string, dto: UpdateRoomTypeInput, access: AccessContext): Promise<RoomTypeView>;
    archive(id: string, access: AccessContext): Promise<void>;
    private requireProperty;
    private ensureNameFree;
}
