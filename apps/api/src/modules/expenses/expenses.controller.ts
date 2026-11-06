import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { expenseSchema, expensesQuerySchema, voidExpenseSchema } from '@pms/validation';
import type { ExpenseInput, ExpensesQuery, VoidExpenseInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Access, RequirePermission } from '../rbac/decorators/access.decorators';
import { ExpensesService } from './expenses.service';

@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @RequirePermission('expense.read')
  @Get('properties/:propertyId/expenses')
  async list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query(new ZodValidationPipe(expensesQuerySchema)) query: ExpensesQuery, @Access() access: AccessContext) {
    return this.expenses.list(propertyId, query, access);
  }

  @RequirePermission('expense.manage')
  @Post('properties/:propertyId/expenses')
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body(new ZodValidationPipe(expenseSchema)) dto: ExpenseInput, @Access() access: AccessContext) {
    return this.expenses.create(propertyId, dto, access);
  }

  @RequirePermission('expense.manage')
  @HttpCode(200)
  @Post('expenses/:id/void')
  void(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(voidExpenseSchema)) dto: VoidExpenseInput, @Access() access: AccessContext) {
    return this.expenses.void(id, dto, access);
  }
}
