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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const toView = (s) => ({
    id: s.id, name: s.name, contactName: s.contactName, email: s.email, phone: s.phone, address: s.address, notes: s.notes,
});
const AUDITED = ['name', 'contactName', 'email', 'phone', 'address', 'notes'];
let SuppliersService = class SuppliersService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list() {
        const rows = await this.prisma.forTenant((tx) => tx.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }));
        return rows.map(toView);
    }
    async create(dto, access) {
        return this.prisma.forTenant(async (tx) => {
            await this.ensureNameFree(tx, dto.name);
            const row = await tx.supplier.create({
                data: { organizationId: access.organizationId, name: dto.name, contactName: (0, text_1.emptyToNull)(dto.contactName) ?? null, email: (0, text_1.emptyToNull)(dto.email) ?? null, phone: (0, text_1.emptyToNull)(dto.phone) ?? null, address: (0, text_1.emptyToNull)(dto.address) ?? null, notes: (0, text_1.emptyToNull)(dto.notes) ?? null },
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'supplier.created', entity: 'supplier', entityId: row.id, after: { name: row.name } });
            return toView(row);
        });
    }
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Supplier');
            if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase())
                await this.ensureNameFree(tx, dto.name);
            const data = {};
            if (dto.name !== undefined)
                data.name = dto.name;
            if (dto.contactName !== undefined)
                data.contactName = (0, text_1.emptyToNull)(dto.contactName);
            if (dto.email !== undefined)
                data.email = (0, text_1.emptyToNull)(dto.email);
            if (dto.phone !== undefined)
                data.phone = (0, text_1.emptyToNull)(dto.phone);
            if (dto.address !== undefined)
                data.address = (0, text_1.emptyToNull)(dto.address);
            if (dto.notes !== undefined)
                data.notes = (0, text_1.emptyToNull)(dto.notes);
            const row = await tx.supplier.update({ where: { id }, data });
            const diff = (0, changed_fields_1.changedFields)(existing, row, AUDITED);
            if (diff.changed.length > 0)
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'supplier.updated', entity: 'supplier', entityId: id, before: diff.before, after: diff.after });
            return toView(row);
        });
    }
    /** Archive only; history keeps pointing at the supplier. Refused while orders are still open. */
    async archive(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const existing = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Supplier');
            if ((await tx.purchaseOrder.count({ where: { supplierId: id, status: { in: [...types_1.OPEN_PURCHASE_STATUSES] } } })) > 0) {
                throw (0, errors_1.conflict)('SUPPLIER_HAS_OPEN_ORDERS', 'This supplier still has open purchase orders. Finish or cancel them first.');
            }
            await tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'supplier.archived', entity: 'supplier', entityId: id, before: { name: existing.name } });
        });
    }
    async ensureNameFree(tx, name) {
        if (await tx.supplier.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null }, select: { id: true } })) {
            throw (0, errors_1.conflict)('SUPPLIER_EXISTS', `A supplier named "${name}" already exists.`);
        }
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map