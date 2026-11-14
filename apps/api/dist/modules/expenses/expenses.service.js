"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const include = { department: { select: { name: true } } };
let ExpensesService = class ExpensesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(propertyId, query, access) {
        (0, assert_access_1.assertCan)(access, 'expense.read', propertyId);
        const where = {
            propertyId,
            ...(query.category ? { category: query.category } : {}),
            ...(query.from || query.to ? { incurredOn: { ...(query.from ? { gte: (0, types_1.parseDate)(query.from) } : {}), ...(query.to ? { lte: (0, types_1.parseDate)(query.to) } : {}) } } : {}),
        };
        return this.prisma.forTenant(async (tx) => {
            const property = await this.requireProperty(tx, propertyId);
            const [rows, total, byCategory] = await Promise.all([
                tx.expense.findMany({ where, include, orderBy: [{ incurredOn: 'desc' }, { createdAt: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
                tx.expense.count({ where }),
                // Totals ignore voided expenses.
                tx.expense.groupBy({ by: ['category'], where: { ...where, voidedAt: null }, _sum: { amountMinor: true } }),
            ]);
            const categories = byCategory.map((c) => ({ category: c.category, totalMinor: c._sum.amountMinor ?? 0 })).sort((a, b) => b.totalMinor - a.totalMinor);
            return {
                items: rows.map((r) => this.toView(r, property.currency)),
                totals: { totalMinor: categories.reduce((s, c) => s + c.totalMinor, 0), byCategory: categories },
                meta: { page: query.page, pageSize: query.pageSize, total },
            };
        });
    }
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'expense.manage', propertyId);
        return this.prisma.forTenant(async (tx) => {
            const property = await this.requireProperty(tx, propertyId);
            if (dto.incurredOn > (0, types_1.addDays)((0, types_1.todayIn)(property.timezone), 1))
                throw (0, errors_1.badRequest)('DATE_IN_FUTURE', "An expense can't be dated in the future.");
            if (dto.departmentId && !(await tx.department.findFirst({ where: { id: dto.departmentId, propertyId }, select: { id: true } }))) {
                throw (0, errors_1.badRequest)('INVALID_DEPARTMENT', 'That department does not belong to this property.');
            }
            const row = await tx.expense.create({
                data: {
                    organizationId: access.organizationId, propertyId, departmentId: dto.departmentId ?? null, category: dto.category, vendor: (0, text_1.emptyToNull)(dto.vendor) ?? null,
                    incurredOn: (0, types_1.parseDate)(dto.incurredOn), amountMinor: dto.amountMinor, paymentMethod: dto.paymentMethod, reference: (0, text_1.emptyToNull)(dto.reference) ?? null, note: (0, text_1.emptyToNull)(dto.note) ?? null, createdById: access.userId,
                },
                include,
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'expense.recorded', entity: 'expense', entityId: row.id, after: { category: row.category, amountMinor: row.amountMinor, vendor: row.vendor, date: dto.incurredOn } });
            return this.toView(row, property.currency);
        });
    }
    /** Expenses are never deleted: a wrong entry is voided with a reason (and re-entered). Supplier payments are voided from purchasing, not here. */
    async void(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.expense.findFirst({ where: { id }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Expense');
            (0, assert_access_1.assertCan)(access, 'expense.manage', existing.propertyId);
            if (existing.source === 'PURCHASING')
                throw (0, errors_1.conflict)('LINKED_TO_INVOICE', 'This expense was created by paying a supplier invoice, so it cannot be voided here.');
            const changed = await tx.expense.updateMany({ where: { id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: dto.reason } });
            if (changed.count === 0)
                throw (0, errors_1.conflict)('ALREADY_VOIDED', 'This expense was already voided.');
            const property = await this.requireProperty(tx, existing.propertyId);
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'expense.voided', entity: 'expense', entityId: id, before: { category: existing.category, amountMinor: existing.amountMinor }, after: { reason: dto.reason } });
            return this.toView(await tx.expense.findFirstOrThrow({ where: { id }, include }), property.currency);
        });
    }
    toView(e, currency) {
        return {
            id: e.id, propertyId: e.propertyId, category: e.category, vendor: e.vendor, departmentName: e.department?.name ?? null, incurredOn: (0, types_1.toDateString)(e.incurredOn),
            amountMinor: e.amountMinor, currency, paymentMethod: e.paymentMethod, reference: e.reference, note: e.note, source: e.source, voided: e.voidedAt !== null, voidReason: e.voidReason,
        };
    }
    async requireProperty(tx, propertyId) {
        const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, currency: true, timezone: true } });
        if (!property)
            throw (0, errors_1.notFound)('Property');
        return property;
    }
};
exports.ExpensesService = ExpensesService;
exports.ExpensesService = ExpensesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ExpensesService);
//# sourceMappingURL=expenses.service.js.map