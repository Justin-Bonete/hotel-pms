import type { InventoryItemInput, MovementInput, TransferInput, UpdateInventoryItemInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { InventoryService } from './inventory.service';
export declare class InventoryController {
    private readonly inventory;
    constructor(inventory: InventoryService);
    list(propertyId: string, access: AccessContext): Promise<import("@pms/types").InventoryItemView[]>;
    movements(propertyId: string, itemId: string, access: AccessContext): Promise<import("@pms/types").StockMovementView[]>;
    record(propertyId: string, dto: MovementInput, access: AccessContext): Promise<import("@pms/types").InventoryItemView>;
    transfer(dto: TransferInput, access: AccessContext): Promise<{
        from: import("@pms/types").InventoryItemView;
        to: import("@pms/types").InventoryItemView;
    }>;
    createItem(dto: InventoryItemInput, access: AccessContext): Promise<import("@pms/types").InventoryItemView>;
    updateItem(id: string, dto: UpdateInventoryItemInput, access: AccessContext): Promise<import("@pms/types").InventoryItemView>;
    archiveItem(id: string, access: AccessContext): Promise<null>;
}
