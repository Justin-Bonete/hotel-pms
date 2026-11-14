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
exports.RatesService = void 0;
const common_1 = require("@nestjs/common");
const assert_access_1 = require("../../common/access/assert-access");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const include = { rates: { include: { roomType: { select: { name: true } } }, orderBy: { roomType: { name: 'asc' } } } };
const toView = (p, currency) => ({
    id: p.id,
    propertyId: p.propertyId,
    name: p.name,
    description: p.description,
    isDefault: p.isDefault,
    currency,
    rates: p.rates.map((r) => ({
        roomTypeId: r.roomTypeId,
        roomTypeName: r.roomType.name,
        nightlyRateMinor: r.nightlyRateMinor,
        weekendRateMinor: r.weekendRateMinor,
    })),
});
let RatesService = class RatesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'rate.read', propertyId);
        return this.prisma.forTenant(async (tx) => {
            const property = await this.requireProperty(tx, propertyId);
            const plans = await tx.ratePlan.findMany({ where: { propertyId, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], include });
            return plans.map((p) => toView(p, property.currency));
        });
    }
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'rate.manage', propertyId);
        return this.prisma.forTenant(async (tx) => {
            const property = await this.requireProperty(tx, propertyId);
            await this.checkRoomTypes(tx, propertyId, dto);
            await this.ensureNameFree(tx, propertyId, dto.name);
            const existingCount = await tx.ratePlan.count({ where: { propertyId, deletedAt: null } });
            const isDefault = existingCount === 0 ? true : dto.isDefault;
            if (isDefault)
                await tx.ratePlan.updateMany({ where: { propertyId, deletedAt: null }, data: { isDefault: false } });
            const plan = await tx.ratePlan.create({
                data: {
                    organizationId: access.organizationId,
                    propertyId,
                    name: dto.name,
                    description: (0, text_1.emptyToNull)(dto.description) ?? null,
                    isDefault,
                    rates: { create: dto.rates.map((r) => ({ organizationId: access.organizationId, roomTypeId: r.roomTypeId, nightlyRateMinor: r.nightlyRateMinor, weekendRateMinor: r.weekendRateMinor })) },
                },
                include,
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'rate_plan.created', entity: 'rate_plan', entityId: plan.id, after: { name: plan.name, isDefault } });
            return toView(plan, property.currency);
        });
    }
    /** Replaces the plan's name, description, default flag and ALL its rates. */
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.ratePlan.findFirst({ where: { id, deletedAt: null }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Rate plan');
            (0, assert_access_1.assertCan)(access, 'rate.manage', existing.propertyId);
            const property = await this.requireProperty(tx, existing.propertyId);
            await this.checkRoomTypes(tx, existing.propertyId, dto);
            if (dto.name.toLowerCase() !== existing.name.toLowerCase())
                await this.ensureNameFree(tx, existing.propertyId, dto.name);
            if (existing.isDefault && !dto.isDefault)
                throw (0, errors_1.conflict)('DEFAULT_REQUIRED', 'Make another plan the default instead. A property always needs one default plan.');
            if (dto.isDefault)
                await tx.ratePlan.updateMany({ where: { propertyId: existing.propertyId, deletedAt: null, id: { not: id } }, data: { isDefault: false } });
            await tx.ratePlanRate.deleteMany({ where: { ratePlanId: id } });
            const plan = await tx.ratePlan.update({
                where: { id },
                data: {
                    name: dto.name,
                    description: (0, text_1.emptyToNull)(dto.description) ?? null,
                    isDefault: dto.isDefault,
                    rates: { create: dto.rates.map((r) => ({ organizationId: access.organizationId, roomTypeId: r.roomTypeId, nightlyRateMinor: r.nightlyRateMinor, weekendRateMinor: r.weekendRateMinor })) },
                },
                include,
            });
            await this.audit.record(tx, {
                organizationId: access.organizationId,
                actorId: access.userId,
                propertyId: existing.propertyId,
                action: 'rate_plan.updated',
                entity: 'rate_plan',
                entityId: id,
                before: { name: existing.name, rates: existing.rates.map((r) => `${r.roomType.name}: ${r.nightlyRateMinor}/${r.weekendRateMinor ?? '-'}`) },
                after: { name: plan.name, rates: plan.rates.map((r) => `${r.roomType.name}: ${r.nightlyRateMinor}/${r.weekendRateMinor ?? '-'}`) },
            });
            return toView(plan, property.currency);
        });
    }
    async archive(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const existing = await tx.ratePlan.findFirst({ where: { id, deletedAt: null } });
            if (!existing)
                throw (0, errors_1.notFound)('Rate plan');
            (0, assert_access_1.assertCan)(access, 'rate.manage', existing.propertyId);
            if (existing.isDefault)
                throw (0, errors_1.conflict)('DEFAULT_REQUIRED', 'This is the default plan. Make another plan the default first.');
            await tx.ratePlan.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'rate_plan.archived', entity: 'rate_plan', entityId: id, before: { name: existing.name } });
        });
    }
    async requireProperty(tx, propertyId) {
        const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, currency: true } });
        if (!property)
            throw (0, errors_1.notFound)('Property');
        return property;
    }
    async checkRoomTypes(tx, propertyId, dto) {
        const ids = [...new Set(dto.rates.map((r) => r.roomTypeId))];
        if (ids.length !== dto.rates.length)
            throw (0, errors_1.badRequest)('DUPLICATE_RATE', 'Each room type can have only one rate in a plan.');
        const found = await tx.roomType.count({ where: { id: { in: ids }, propertyId, deletedAt: null } });
        if (found !== ids.length)
            throw (0, errors_1.badRequest)('INVALID_ROOM_TYPE', 'One of the room types does not belong to this property.');
    }
    async ensureNameFree(tx, propertyId, name) {
        const clash = await tx.ratePlan.findFirst({ where: { propertyId, deletedAt: null, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
        if (clash)
            throw (0, errors_1.conflict)('RATE_PLAN_EXISTS', `A rate plan named "${name}" already exists.`);
    }
};
exports.RatesService = RatesService;
exports.RatesService = RatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RatesService);
//# sourceMappingURL=rates.service.js.map