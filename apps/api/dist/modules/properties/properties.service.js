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
exports.PropertiesService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const response_interceptor_1 = require("../../common/http/response.interceptor");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const properties_repository_1 = require("./properties.repository");
const AUDITED_FIELDS = [
    'name', 'type', 'groupId', 'addressLine1', 'addressLine2', 'city', 'region', 'postalCode',
    'country', 'phone', 'email', 'timezone', 'currency', 'checkInTime', 'checkOutTime',
];
const toSummary = (p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    status: p.status,
    city: p.city,
    region: p.region,
    groupName: p.group?.name ?? null,
    roomCount: p._count.rooms,
});
const toDetail = (p) => ({
    ...toSummary(p),
    groupId: p.groupId,
    addressLine1: p.addressLine1,
    addressLine2: p.addressLine2,
    postalCode: p.postalCode,
    country: p.country,
    phone: p.phone,
    email: p.email,
    timezone: p.timezone,
    currency: p.currency,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
});
let PropertiesService = class PropertiesService {
    prisma;
    repo;
    audit;
    constructor(prisma, repo, audit) {
        this.prisma = prisma;
        this.repo = repo;
        this.audit = audit;
    }
    async list(query, scope) {
        const { rows, total } = await this.prisma.forTenant((tx) => this.repo.list(tx, { skip: (query.page - 1) * query.pageSize, take: query.pageSize, scope }));
        return new response_interceptor_1.Paginated(rows.map(toSummary), { page: query.page, pageSize: query.pageSize, total });
    }
    async get(id, access) {
        (0, assert_access_1.assertCan)(access, 'property.read', id);
        const property = await this.prisma.forTenant((tx) => this.repo.findById(tx, id));
        if (!property)
            throw (0, errors_1.notFound)('Property');
        return toDetail(property);
    }
    async create(dto, access) {
        const created = await this.prisma.forTenant(async (tx) => {
            if (dto.groupId)
                await this.requireGroup(tx, dto.groupId);
            const property = await this.repo.create(tx, {
                organizationId: access.organizationId,
                slug: await this.uniqueSlug(tx, dto.name),
                name: dto.name,
                type: dto.type,
                groupId: dto.groupId || null,
                addressLine1: (0, text_1.emptyToNull)(dto.addressLine1),
                addressLine2: (0, text_1.emptyToNull)(dto.addressLine2),
                city: (0, text_1.emptyToNull)(dto.city),
                region: (0, text_1.emptyToNull)(dto.region),
                postalCode: (0, text_1.emptyToNull)(dto.postalCode),
                phone: (0, text_1.emptyToNull)(dto.phone),
                email: (0, text_1.emptyToNull)(dto.email),
                country: dto.country?.toUpperCase(),
                timezone: dto.timezone,
                currency: dto.currency?.toUpperCase(),
                checkInTime: dto.checkInTime,
                checkOutTime: dto.checkOutTime,
            });
            await this.audit.record(tx, {
                organizationId: access.organizationId,
                actorId: access.userId,
                propertyId: property.id,
                action: 'property.created',
                entity: 'property',
                entityId: property.id,
                after: { name: property.name, type: property.type },
            });
            return property;
        });
        return toDetail(created);
    }
    async update(id, dto, access) {
        (0, assert_access_1.assertCan)(access, 'property.update', id);
        const updated = await this.prisma.forTenant(async (tx) => {
            const existing = await this.repo.findById(tx, id);
            if (!existing)
                throw (0, errors_1.notFound)('Property');
            if (dto.groupId)
                await this.requireGroup(tx, dto.groupId);
            const data = {};
            if (dto.name !== undefined)
                data.name = dto.name;
            if (dto.type !== undefined)
                data.type = dto.type;
            if (dto.groupId !== undefined)
                data.groupId = dto.groupId || null;
            if (dto.addressLine1 !== undefined)
                data.addressLine1 = (0, text_1.emptyToNull)(dto.addressLine1);
            if (dto.addressLine2 !== undefined)
                data.addressLine2 = (0, text_1.emptyToNull)(dto.addressLine2);
            if (dto.city !== undefined)
                data.city = (0, text_1.emptyToNull)(dto.city);
            if (dto.region !== undefined)
                data.region = (0, text_1.emptyToNull)(dto.region);
            if (dto.postalCode !== undefined)
                data.postalCode = (0, text_1.emptyToNull)(dto.postalCode);
            if (dto.phone !== undefined)
                data.phone = (0, text_1.emptyToNull)(dto.phone);
            if (dto.email !== undefined)
                data.email = (0, text_1.emptyToNull)(dto.email);
            if (dto.country !== undefined)
                data.country = dto.country.toUpperCase();
            if (dto.timezone !== undefined)
                data.timezone = dto.timezone;
            if (dto.currency !== undefined)
                data.currency = dto.currency.toUpperCase();
            if (dto.checkInTime !== undefined)
                data.checkInTime = dto.checkInTime;
            if (dto.checkOutTime !== undefined)
                data.checkOutTime = dto.checkOutTime;
            const property = await this.repo.update(tx, id, data);
            const diff = (0, changed_fields_1.changedFields)(existing, property, AUDITED_FIELDS);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, {
                    organizationId: access.organizationId,
                    actorId: access.userId,
                    propertyId: id,
                    action: 'property.updated',
                    entity: 'property',
                    entityId: id,
                    before: diff.before,
                    after: diff.after,
                });
            }
            return property;
        });
        return toDetail(updated);
    }
    /** Archive, never hard delete. Refused while the property still has rooms. */
    async archive(id, access) {
        (0, assert_access_1.assertCan)(access, 'property.delete', id);
        await this.prisma.forTenant(async (tx) => {
            const existing = await this.repo.findById(tx, id);
            if (!existing)
                throw (0, errors_1.notFound)('Property');
            if ((await this.repo.countActiveRooms(tx, id)) > 0) {
                throw (0, errors_1.conflict)('PROPERTY_HAS_ROOMS', 'This property still has rooms. Archive its rooms first.');
            }
            await this.repo.update(tx, id, { deletedAt: new Date(), status: 'INACTIVE' });
            await this.audit.record(tx, {
                organizationId: access.organizationId,
                actorId: access.userId,
                propertyId: id,
                action: 'property.archived',
                entity: 'property',
                entityId: id,
                before: { name: existing.name },
            });
        });
    }
    async requireGroup(tx, groupId) {
        if (!(await this.repo.groupExists(tx, groupId)))
            throw (0, errors_1.badRequest)('INVALID_GROUP', 'That property group does not exist.');
    }
    async uniqueSlug(tx, name) {
        const base = (0, text_1.slugify)(name);
        if (!(await this.repo.slugExists(tx, base)))
            return base;
        for (let i = 0; i < 5; i++) {
            const candidate = `${base}-${(0, node_crypto_1.randomBytes)(2).toString('hex')}`;
            if (!(await this.repo.slugExists(tx, candidate)))
                return candidate;
        }
        throw (0, errors_1.conflict)('SLUG_UNAVAILABLE', 'Could not create a unique address for this property. Try a different name.');
    }
};
exports.PropertiesService = PropertiesService;
exports.PropertiesService = PropertiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        properties_repository_1.PropertiesRepository,
        audit_service_1.AuditService])
], PropertiesService);
//# sourceMappingURL=properties.service.js.map