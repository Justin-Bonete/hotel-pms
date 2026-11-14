import { type SupplierView } from '@pms/types';
import type { SupplierInput, UpdateSupplierInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class SuppliersService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(): Promise<SupplierView[]>;
    create(dto: SupplierInput, access: AccessContext): Promise<SupplierView>;
    update(id: string, dto: UpdateSupplierInput, access: AccessContext): Promise<SupplierView>;
    /** Archive only; history keeps pointing at the supplier. Refused while orders are still open. */
    archive(id: string, access: AccessContext): Promise<void>;
    private ensureNameFree;
}
