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
exports.PropertyGroupsService = void 0;
const common_1 = require("@nestjs/common");
const errors_1 = require("../../common/http/errors");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const include = { _count: { select: { properties: { where: { deletedAt: null } } } } };
let PropertyGroupsService = class PropertyGroupsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list() {
        const groups = await this.prisma.forTenant((tx) => tx.propertyGroup.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, include }));
        return groups.map((g) => ({ id: g.id, name: g.name, propertyCount: g._count.properties }));
    }
    async create(dto, access) {
        return this.prisma.forTenant(async (tx) => {
            await this.ensureNameFree(tx, dto.name);
            const g = await tx.propertyGroup.create({ data: { organizationId: access.organizationId, name: dto.name }, include });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'property_group.created', entity: 'property_group', entityId: g.id, after: { name: g.name } });
            return { id: g.id, name: g.name, propertyCount: g._count.properties };
        });
    }
    async rename(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.propertyGroup.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Property group');
            if (existing.name !== dto.name)
                await this.ensureNameFree(tx, dto.name);
            const g = await tx.propertyGroup.update({ where: { id }, data: { name: dto.name }, include });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'property_group.renamed', entity: 'property_group', entityId: id, before: { name: existing.name }, after: { name: g.name } });
            return { id: g.id, name: g.name, propertyCount: g._count.properties };
        });
    }
    /** Groups are only labels, so an EMPTY group may be removed for real. */
    async remove(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const g = await tx.propertyGroup.findFirst({ where: { id, deletedAt: null }, include });
            if (!g)
                throw (0, errors_1.notFound)('Property group');
            if (g._count.properties > 0)
                throw (0, errors_1.conflict)('GROUP_NOT_EMPTY', 'Move this group’s properties to another group first.');
            await tx.propertyGroup.delete({ where: { id } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'property_group.deleted', entity: 'property_group', entityId: id, before: { name: g.name } });
        });
    }
    async ensureNameFree(tx, name) {
        const clash = await tx.propertyGroup.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
        if (clash)
            throw (0, errors_1.conflict)('GROUP_EXISTS', `A group named "${name}" already exists.`);
    }
};
exports.PropertyGroupsService = PropertyGroupsService;
exports.PropertyGroupsService = PropertyGroupsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PropertyGroupsService);
//# sourceMappingURL=property-groups.service.js.map