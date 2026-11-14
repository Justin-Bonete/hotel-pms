import { type PosMenuView, type PosOrderView, type PosSummaryView } from '@pms/types';
import type { CreatePosOrderInput, OutletInput, PosItemInput, PosOrdersQuery, UpdateOutletInput, UpdatePosItemInput, VoidPosOrderInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FolioLedger } from '../folios/folio-ledger.service';
import { RealtimeService } from '../realtime/realtime.service';
export declare class PosService {
    private readonly prisma;
    private readonly audit;
    private readonly ledger;
    private readonly realtime;
    constructor(prisma: PrismaService, audit: AuditService, ledger: FolioLedger, realtime: RealtimeService);
    /** Everything the till needs: outlets, their items, the taxes that will apply, and the currency. */
    menu(propertyId: string, access: AccessContext): Promise<PosMenuView>;
    createOutlet(propertyId: string, dto: OutletInput, access: AccessContext): Promise<{
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.OutletType;
        items: never[];
    }>;
    updateOutlet(id: string, dto: UpdateOutletInput, access: AccessContext): Promise<{
        id: string;
        name: string;
        type: import("@prisma/client").$Enums.OutletType;
    }>;
    /** Archive only. Past sales keep pointing at the outlet. */
    archiveOutlet(id: string, access: AccessContext): Promise<void>;
    createItem(dto: PosItemInput, access: AccessContext): Promise<{
        id: string;
    }>;
    updateItem(id: string, dto: UpdatePosItemInput, access: AccessContext): Promise<{
        id: string;
    }>;
    archiveItem(id: string, access: AccessContext): Promise<void>;
    /**
     * Rings up a sale. The server works out every price and tax itself (the till only says WHAT and HOW MANY), refuses a
     * sale that would take tracked stock below zero, and for a room charge posts to the guest's bill in the same transaction.
     * A repeated Idempotency-Key returns the first sale instead of creating a second one.
     */
    create(propertyId: string, dto: CreatePosOrderInput, key: string | undefined, access: AccessContext): Promise<PosOrderView>;
    /** Voiding reverses everything the sale did: the folio lines (room charge) and the stock it used. Needs pos.void. */
    void(id: string, dto: VoidPosOrderInput, access: AccessContext): Promise<PosOrderView>;
    list(propertyId: string, query: PosOrdersQuery, access: AccessContext): Promise<PosOrderView[]>;
    /** The cashier report: sales for a day by outlet and by how they were settled. Voided sales are counted separately, never in sales. */
    summary(propertyId: string, query: PosOrdersQuery, access: AccessContext): Promise<PosSummaryView>;
    private views;
    private requireProperty;
    private newCode;
}
