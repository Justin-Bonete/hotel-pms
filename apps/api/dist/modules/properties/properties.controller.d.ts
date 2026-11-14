import type { CreatePropertyInput, PaginationInput, UpdatePropertyInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PropertiesService } from './properties.service';
export declare class PropertiesController {
    private readonly properties;
    constructor(properties: PropertiesService);
    list(query: PaginationInput, access: AccessContext): Promise<import("../../common/http/response.interceptor").Paginated<import("@pms/types").PropertySummary>>;
    get(id: string, access: AccessContext): Promise<import("@pms/types").PropertyDetail>;
    create(dto: CreatePropertyInput, access: AccessContext): Promise<import("@pms/types").PropertyDetail>;
    update(id: string, dto: UpdatePropertyInput, access: AccessContext): Promise<import("@pms/types").PropertyDetail>;
    archive(id: string, access: AccessContext): Promise<null>;
}
