import { type InventoryItemView, type StockMovementView } from '@pms/types';
import type { InventoryItemInput, MovementInput, TransferInput, UpdateInventoryItemInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class InventoryService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    /** Every item with this property's on-hand stock (sum of its movements). */
    list(propertyId: string, access: AccessContext): Promise<InventoryItemView[]>;
    movements(propertyId: string, itemId: string, access: AccessContext): Promise<StockMovementView[]>;
    createItem(dto: InventoryItemInput, access: AccessContext): Promise<InventoryItemView>;
    updateItem(id: string, dto: UpdateInventoryItemInput, access: AccessContext): Promise<InventoryItemView>;
    /** Archive only. Refused while stock remains anywhere or an open purchase order still wants the item. */
    archiveItem(id: string, access: AccessContext): Promise<void>;
    /** Opening count, usage, wastage or a count adjustment. Stock can never be taken below zero. */
    record(propertyId: string, dto: MovementInput, access: AccessContext): Promise<InventoryItemView>;
    /** Move stock between two properties atomically: out of one and into the other, or neither. Needs inventory.manage at BOTH. */
    transfer(dto: TransferInput, access: AccessContext): Promise<{
        from: InventoryItemView;
        to: InventoryItemView;
    }>;
    private balance;
    private lock;
    private requireProperty;
    private requireItem;
    private ensureSkuFree;
}
