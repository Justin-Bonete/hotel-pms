import type { CreateOrderInput, DecisionInput, InvoiceInput, InvoicesQuery, OrdersQuery, PayInvoiceInput, ReceiveInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PurchasingService } from './purchasing.service';
export declare class PurchasingController {
    private readonly purchasing;
    constructor(purchasing: PurchasingService);
    list(propertyId: string, query: OrdersQuery, access: AccessContext): Promise<import("@pms/types").PurchaseOrderView[]>;
    create(propertyId: string, dto: CreateOrderInput, access: AccessContext): Promise<import("@pms/types").PurchaseOrderView>;
    /** Approve/reject need purchasing.approve; the requester may cancel their own request. The service checks which. */
    decide(id: string, dto: DecisionInput, access: AccessContext): Promise<import("@pms/types").PurchaseOrderView>;
    receive(id: string, dto: ReceiveInput, access: AccessContext): Promise<import("@pms/types").PurchaseOrderView>;
    invoice(id: string, dto: InvoiceInput, access: AccessContext): Promise<import("@pms/types").PurchaseOrderView>;
    invoices(propertyId: string, query: InvoicesQuery, access: AccessContext): Promise<import("@pms/types").SupplierInvoiceView[]>;
    pay(id: string, dto: PayInvoiceInput, access: AccessContext): Promise<import("@pms/types").SupplierInvoiceView>;
}
