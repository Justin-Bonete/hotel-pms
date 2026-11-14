import type { CreatePosOrderInput, OutletInput, PosItemInput, PosOrdersQuery, UpdateOutletInput, UpdatePosItemInput, VoidPosOrderInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PosService } from './pos.service';
export declare class PosController {
    private readonly pos;
    constructor(pos: PosService);
    menu(propertyId: string, access: AccessContext): Promise<import("@pms/types").PosMenuView>;
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
    archiveOutlet(id: string, access: AccessContext): Promise<null>;
    createItem(dto: PosItemInput, access: AccessContext): Promise<{
        id: string;
    }>;
    updateItem(id: string, dto: UpdatePosItemInput, access: AccessContext): Promise<{
        id: string;
    }>;
    archiveItem(id: string, access: AccessContext): Promise<null>;
    create(propertyId: string, dto: CreatePosOrderInput, key: string | undefined, access: AccessContext): Promise<import("@pms/types").PosOrderView>;
    list(propertyId: string, query: PosOrdersQuery, access: AccessContext): Promise<import("@pms/types").PosOrderView[]>;
    summary(propertyId: string, query: PosOrdersQuery, access: AccessContext): Promise<import("@pms/types").PosSummaryView>;
    void(id: string, dto: VoidPosOrderInput, access: AccessContext): Promise<import("@pms/types").PosOrderView>;
}
