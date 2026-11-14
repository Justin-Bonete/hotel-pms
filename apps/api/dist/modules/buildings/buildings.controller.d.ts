import type { BuildingInput, FloorInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { BuildingsService } from './buildings.service';
export declare class BuildingsController {
    private readonly buildings;
    constructor(buildings: BuildingsService);
    structure(propertyId: string, access: AccessContext): Promise<import("@pms/types").BuildingView[]>;
    addBuilding(propertyId: string, dto: BuildingInput, access: AccessContext): Promise<import("@pms/types").BuildingView>;
    addFloor(propertyId: string, buildingId: string, dto: FloorInput, access: AccessContext): Promise<{
        id: string;
        level: number;
        name: string | null;
    }>;
}
