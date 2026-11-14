import type { PropertyGroupView } from '@pms/types';
import type { PropertyGroupInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class PropertyGroupsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(): Promise<PropertyGroupView[]>;
    create(dto: PropertyGroupInput, access: AccessContext): Promise<PropertyGroupView>;
    rename(id: string, dto: PropertyGroupInput, access: AccessContext): Promise<PropertyGroupView>;
    /** Groups are only labels, so an EMPTY group may be removed for real. */
    remove(id: string, access: AccessContext): Promise<void>;
    private ensureNameFree;
}
