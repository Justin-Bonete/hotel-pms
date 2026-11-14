import type { RoomTypeInput, UpdateRoomTypeInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { RoomTypesService } from './room-types.service';
export declare class RoomTypesController {
    private readonly roomTypes;
    constructor(roomTypes: RoomTypesService);
    list(propertyId: string, access: AccessContext): Promise<import("@pms/types").RoomTypeView[]>;
    create(propertyId: string, dto: RoomTypeInput, access: AccessContext): Promise<import("@pms/types").RoomTypeView>;
    update(id: string, dto: UpdateRoomTypeInput, access: AccessContext): Promise<import("@pms/types").RoomTypeView>;
    archive(id: string, access: AccessContext): Promise<null>;
}
