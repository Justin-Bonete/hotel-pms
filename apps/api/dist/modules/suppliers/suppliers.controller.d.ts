import type { SupplierInput, UpdateSupplierInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { SuppliersService } from './suppliers.service';
export declare class SuppliersController {
    private readonly suppliers;
    constructor(suppliers: SuppliersService);
    list(): Promise<import("@pms/types").SupplierView[]>;
    create(dto: SupplierInput, access: AccessContext): Promise<import("@pms/types").SupplierView>;
    update(id: string, dto: UpdateSupplierInput, access: AccessContext): Promise<import("@pms/types").SupplierView>;
    archive(id: string, access: AccessContext): Promise<null>;
}
