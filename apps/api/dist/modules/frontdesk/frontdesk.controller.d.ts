import type { AccessContext } from '../../common/access/access-context';
import { FrontDeskService } from './frontdesk.service';
export declare class FrontDeskController {
    private readonly frontDesk;
    constructor(frontDesk: FrontDeskService);
    get(propertyId: string, access: AccessContext): Promise<import("@pms/types").FrontDeskView>;
}
