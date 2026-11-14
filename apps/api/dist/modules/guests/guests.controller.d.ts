import type { GuestInput, GuestsQuery, UpdateGuestInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { GuestsService } from './guests.service';
export declare class GuestsController {
    private readonly guests;
    constructor(guests: GuestsService);
    list(query: GuestsQuery): Promise<import("../../common/http/response.interceptor").Paginated<import("@pms/types").GuestView>>;
    get(id: string, access: AccessContext): Promise<import("@pms/types").GuestDetail>;
    create(dto: GuestInput, access: AccessContext): Promise<import("@pms/types").GuestView>;
    update(id: string, dto: UpdateGuestInput, access: AccessContext): Promise<import("@pms/types").GuestView>;
}
