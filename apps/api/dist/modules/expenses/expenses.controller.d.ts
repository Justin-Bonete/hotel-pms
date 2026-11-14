import type { ExpenseInput, ExpensesQuery, VoidExpenseInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ExpensesService } from './expenses.service';
export declare class ExpensesController {
    private readonly expenses;
    constructor(expenses: ExpensesService);
    list(propertyId: string, query: ExpensesQuery, access: AccessContext): Promise<import("@pms/types").ExpenseListView>;
    create(propertyId: string, dto: ExpenseInput, access: AccessContext): Promise<import("@pms/types").ExpenseView>;
    void(id: string, dto: VoidExpenseInput, access: AccessContext): Promise<import("@pms/types").ExpenseView>;
}
