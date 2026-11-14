import type { RatePlanInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { RatesService } from './rates.service';
export declare class RatesController {
    private readonly rates;
    constructor(rates: RatesService);
    list(propertyId: string, access: AccessContext): Promise<import("@pms/types").RatePlanView[]>;
    create(propertyId: string, dto: RatePlanInput, access: AccessContext): Promise<import("@pms/types").RatePlanView>;
    update(id: string, dto: RatePlanInput, access: AccessContext): Promise<import("@pms/types").RatePlanView>;
    archive(id: string, access: AccessContext): Promise<null>;
}
