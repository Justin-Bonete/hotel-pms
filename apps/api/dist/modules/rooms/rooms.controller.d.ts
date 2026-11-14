import type { RoomInput, RoomStatusInput, RoomsQuery, UpdateRoomInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { RoomsService } from './rooms.service';
export declare class RoomsController {
    private readonly rooms;
    constructor(rooms: RoomsService);
    list(propertyId: string, query: RoomsQuery, access: AccessContext): Promise<import("../../common/http/response.interceptor").Paginated<import("@pms/types").RoomView>>;
    create(propertyId: string, dto: RoomInput, access: AccessContext): Promise<import("@pms/types").RoomView>;
    update(id: string, dto: UpdateRoomInput, access: AccessContext): Promise<import("@pms/types").RoomView>;
    changeStatus(id: string, dto: RoomStatusInput, access: AccessContext): Promise<import("@pms/types").RoomView>;
    archive(id: string, access: AccessContext): Promise<null>;
}
