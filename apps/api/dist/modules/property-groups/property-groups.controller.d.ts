import type { PropertyGroupInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PropertyGroupsService } from './property-groups.service';
export declare class PropertyGroupsController {
    private readonly groups;
    constructor(groups: PropertyGroupsService);
    list(): Promise<import("@pms/types").PropertyGroupView[]>;
    create(dto: PropertyGroupInput, access: AccessContext): Promise<import("@pms/types").PropertyGroupView>;
    rename(id: string, dto: PropertyGroupInput, access: AccessContext): Promise<import("@pms/types").PropertyGroupView>;
    remove(id: string, access: AccessContext): Promise<null>;
}
