import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDays, parseDate, toDateString, todayIn, type ExpenseCategory, type ExpenseListView, type ExpenseView } from '@pms/types';
import type { ExpenseInput, ExpensesQuery, VoidExpenseInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = { department: { select: { name: true } } } satisfies Prisma.ExpenseInclude;
type Row = Prisma.ExpenseGetPayload<{ include: typeof include }>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string, query: ExpensesQuery, access: AccessContext): Promise<ExpenseListView> {
    assertCan(access, 'expense.read', propertyId);
    const where: Prisma.ExpenseWhereInput = {
      propertyId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.from || query.to ? { incurredOn: { ...(query.from ? { gte: parseDate(query.from) } : {}), ...(query.to ? { lte: parseDate(query.to) } : {}) } } : {}),
    };
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const [rows, total, byCategory] = await Promise.all([
        tx.expense.findMany({ where, include, orderBy: [{ incurredOn: 'desc' }, { createdAt: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
        tx.expense.count({ where }),
        // Totals ignore voided expenses.
        tx.expense.groupBy({ by: ['category'], where: { ...where, voidedAt: null }, _sum: { amountMinor: true } }),
      ]);
      const categories = byCategory.map((c) => ({ category: c.category as ExpenseCategory, totalMinor: c._sum.amountMinor ?? 0 })).sort((a, b) => b.totalMinor - a.totalMinor);
      return {
        items: rows.map((r) => this.toView(r, property.currency)),
        totals: { totalMinor: categories.reduce((s, c) => s + c.totalMinor, 0), byCategory: categories },
        meta: { page: query.page, pageSize: query.pageSize, total },
      };
    });
  }

  async create(propertyId: string, dto: ExpenseInput, access: AccessContext): Promise<ExpenseView> {
    assertCan(access, 'expense.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      if (dto.incurredOn > addDays(todayIn(property.timezone), 1)) throw badRequest('DATE_IN_FUTURE', "An expense can't be dated in the future.");
      if (dto.departmentId && !(await tx.department.findFirst({ where: { id: dto.departmentId, propertyId }, select: { id: true } }))) {
        throw badRequest('INVALID_DEPARTMENT', 'That department does not belong to this property.');
      }
      const row = await tx.expense.create({
        data: {
          organizationId: access.organizationId, propertyId, departmentId: dto.departmentId ?? null, category: dto.category, vendor: emptyToNull(dto.vendor) ?? null,
          incurredOn: parseDate(dto.incurredOn), amountMinor: dto.amountMinor, paymentMethod: dto.paymentMethod, reference: emptyToNull(dto.reference) ?? null, note: emptyToNull(dto.note) ?? null, createdById: access.userId,
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'expense.recorded', entity: 'expense', entityId: row.id, after: { category: row.category, amountMinor: row.amountMinor, vendor: row.vendor, date: dto.incurredOn } });
      return this.toView(row, property.currency);
    });
  }

  /** Expenses are never deleted: a wrong entry is voided with a reason (and re-entered). Supplier payments are voided from purchasing, not here. */
  async void(id: string, dto: VoidExpenseInput, access: AccessContext): Promise<ExpenseView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.expense.findFirst({ where: { id }, include });
      if (!existing) throw notFound('Expense');
      assertCan(access, 'expense.manage', existing.propertyId);
      if (existing.source === 'PURCHASING') throw conflict('LINKED_TO_INVOICE', 'This expense was created by paying a supplier invoice, so it cannot be voided here.');
      const changed = await tx.expense.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: dto.reason } });
      if (changed.count === 0) throw conflict('ALREADY_VOIDED', 'This expense was already voided.');
      const property = await this.requireProperty(tx, existing.propertyId);
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'expense.voided', entity: 'expense', entityId: id, before: { category: existing.category, amountMinor: existing.amountMinor }, after: { reason: dto.reason } });
      return this.toView(await tx.expense.findFirstOrThrow({ where: { id }, include }), property.currency);
    });
  }

  private toView(e: Row, currency: string): ExpenseView {
    return {
      id: e.id, propertyId: e.propertyId, category: e.category, vendor: e.vendor, departmentName: e.department?.name ?? null, incurredOn: toDateString(e.incurredOn),
      amountMinor: e.amountMinor, currency, paymentMethod: e.paymentMethod, reference: e.reference, note: e.note, source: e.source, voided: e.voidedAt !== null, voidReason: e.voidReason,
    };
  }

  private async requireProperty(tx: Tx, propertyId: string) {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, currency: true, timezone: true } });
    if (!property) throw notFound('Property');
    return property;
  }
}
