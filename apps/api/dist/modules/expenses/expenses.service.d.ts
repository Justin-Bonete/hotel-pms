import { type ExpenseListView, type ExpenseView } from '@pms/types';
import type { ExpenseInput, ExpensesQuery, VoidExpenseInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class ExpensesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(propertyId: string, query: ExpensesQuery, access: AccessContext): Promise<ExpenseListView>;
    create(propertyId: string, dto: ExpenseInput, access: AccessContext): Promise<ExpenseView>;
    /** Expenses are never deleted: a wrong entry is voided with a reason (and re-entered). Supplier payments are voided from purchasing, not here. */
    void(id: string, dto: VoidExpenseInput, access: AccessContext): Promise<ExpenseView>;
    private toView;
    private requireProperty;
}
