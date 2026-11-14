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
exports.TaxesService = void 0;
const common_1 = require("@nestjs/common");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const toView = (t) => ({
    id: t.id, propertyId: t.propertyId, name: t.name, rateBps: t.rateBps, appliesToRoom: t.appliesToRoom, appliesToExtras: t.appliesToExtras, isActive: t.isActive,
});
let TaxesService = class TaxesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'rate.read', propertyId);
        const rows = await this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            return tx.tax.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' } });
        });
        return rows.map(toView);
    }
    /** Taxes apply to charges posted AFTER the change. Lines already on a folio are never rewritten. */
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'tax.manage', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            await this.ensureNameFree(tx, propertyId, dto.name);
            const row = await tx.tax.create({ data: { organizationId: access.organizationId, propertyId, ...dto } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'tax.created', entity: 'tax', entityId: row.id, after: { name: row.name, rateBps: row.rateBps } });
            return toView(row);
        });
    }
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.tax.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Tax');
            (0, assert_access_1.assertCan)(access, 'tax.manage', existing.propertyId);
            if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase())
                await this.ensureNameFree(tx, existing.propertyId, dto.name);
            const data = { ...dto };
            const row = await tx.tax.update({ where: { id }, data });
            const diff = (0, changed_fields_1.changedFields)(existing, row, ['name', 'rateBps', 'appliesToRoom', 'appliesToExtras', 'isActive']);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: row.propertyId, action: 'tax.updated', entity: 'tax', entityId: id, before: diff.before, after: diff.after });
            }
            return toView(row);
        });
    }
    async archive(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const existing = await tx.tax.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Tax');
            (0, assert_access_1.assertCan)(access, 'tax.manage', existing.propertyId);
            await tx.tax.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'tax.archived', entity: 'tax', entityId: id, before: { name: existing.name } });
        });
    }
    async requireProperty(tx, propertyId) {
        if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0)
            throw (0, errors_1.notFound)('Property');
    }
    async ensureNameFree(tx, propertyId, name) {
        if (await tx.tax.findFirst({ where: { propertyId, deletedAt: null, name: { equals: name, mode: 'insensitive' } }, select: { id: true } })) {
            throw (0, errors_1.conflict)('TAX_EXISTS', `A tax named "${name}" already exists at this property.`);
        }
    }
};
exports.TaxesService = TaxesService;
exports.TaxesService = TaxesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], TaxesService);
//# sourceMappingURL=taxes.service.js.map