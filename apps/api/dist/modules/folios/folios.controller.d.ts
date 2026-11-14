import type { AdjustmentInput, ChargeInput, PaymentInput, RefundInput, VoidInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { FoliosService } from './folios.service';
/** Every money-moving route accepts an optional Idempotency-Key header: replaying it never posts twice. */
export declare class FoliosController {
    private readonly folios;
    constructor(folios: FoliosService);
    get(id: string, access: AccessContext): Promise<import("@pms/types").FolioView>;
    charge(id: string, dto: ChargeInput, key: string | undefined, access: AccessContext): Promise<import("@pms/types").FolioView>;
    adjust(id: string, dto: AdjustmentInput, access: AccessContext): Promise<import("@pms/types").FolioView>;
    pay(id: string, dto: PaymentInput, key: string | undefined, access: AccessContext): Promise<import("@pms/types").FolioView>;
    voidItem(id: string, dto: VoidInput, access: AccessContext): Promise<import("@pms/types").FolioView>;
    refund(id: string, dto: RefundInput, key: string | undefined, access: AccessContext): Promise<import("@pms/types").FolioView>;
}
