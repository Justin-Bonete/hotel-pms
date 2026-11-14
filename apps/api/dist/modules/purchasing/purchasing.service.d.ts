import { type PurchaseOrderView, type SupplierInvoiceView } from '@pms/types';
import type { CreateOrderInput, DecisionInput, InvoiceInput, InvoicesQuery, OrdersQuery, PayInvoiceInput, ReceiveInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
export declare class PurchasingService {
    private readonly prisma;
    private readonly audit;
    private readonly rbac;
    constructor(prisma: PrismaService, audit: AuditService, rbac: RbacService);
    list(propertyId: string, query: OrdersQuery, access: AccessContext): Promise<PurchaseOrderView[]>;
    listInvoices(propertyId: string, query: InvoicesQuery, access: AccessContext): Promise<SupplierInvoiceView[]>;
    create(propertyId: string, dto: CreateOrderInput, access: AccessContext): Promise<PurchaseOrderView>;
    decide(id: string, dto: DecisionInput, access: AccessContext): Promise<PurchaseOrderView>;
    /** Receiving adds to the stock ledger. You can never receive more than was ordered; two people receiving at once take turns. */
    receive(id: string, dto: ReceiveInput, access: AccessContext): Promise<PurchaseOrderView>;
    /** Records the supplier's invoice and compares it with what was actually received. A difference is shown, never hidden. */
    invoice(id: string, dto: InvoiceInput, access: AccessContext): Promise<PurchaseOrderView>;
    /** Paying marks the invoice paid and records the expense, in one step and exactly once. */
    payInvoice(invoiceId: string, dto: PayInvoiceInput, access: AccessContext): Promise<SupplierInvoiceView>;
    private load;
    private views;
    private invoiceView;
    private requireProperty;
    private newCode;
}
