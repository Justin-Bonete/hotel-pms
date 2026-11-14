import type { TaxInput, UpdateTaxInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { TaxesService } from './taxes.service';
export declare class TaxesController {
    private readonly taxes;
    constructor(taxes: TaxesService);
    list(propertyId: string, access: AccessContext): Promise<import("@pms/types").TaxView[]>;
    create(propertyId: string, dto: TaxInput, access: AccessContext): Promise<import("@pms/types").TaxView>;
    update(id: string, dto: UpdateTaxInput, access: AccessContext): Promise<import("@pms/types").TaxView>;
    archive(id: string, access: AccessContext): Promise<null>;
}
