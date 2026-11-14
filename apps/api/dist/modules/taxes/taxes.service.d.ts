import type { TaxView } from '@pms/types';
import type { TaxInput, UpdateTaxInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class TaxesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(propertyId: string, access: AccessContext): Promise<TaxView[]>;
    /** Taxes apply to charges posted AFTER the change. Lines already on a folio are never rewritten. */
    create(propertyId: string, dto: TaxInput, access: AccessContext): Promise<TaxView>;
    update(id: string, dto: UpdateTaxInput, access: AccessContext): Promise<TaxView>;
    archive(id: string, access: AccessContext): Promise<void>;
    private requireProperty;
    private ensureNameFree;
}
