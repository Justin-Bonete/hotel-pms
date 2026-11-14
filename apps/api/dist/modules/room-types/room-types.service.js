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
exports.RoomTypesService = void 0;
const common_1 = require("@nestjs/common");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const include = { _count: { select: { rooms: { where: { deletedAt: null } } } } };
const toView = (r) => ({
    id: r.id,
    propertyId: r.propertyId,
    name: r.name,
    description: r.description,
    maxOccupancy: r.maxOccupancy,
    bedConfiguration: r.bedConfiguration,
    amenities: r.amenities,
    roomCount: r._count.rooms,
});
const AUDITED = ['name', 'description', 'maxOccupancy', 'bedConfiguration', 'amenities'];
let RoomTypesService = class RoomTypesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'room.read', propertyId);
        const rows = await this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            return tx.roomType.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' }, include });
        });
        return rows.map(toView);
    }
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'room_type.manage', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            await this.ensureNameFree(tx, propertyId, dto.name);
            const row = await tx.roomType.create({
                data: {
                    organizationId: access.organizationId,
                    propertyId,
                    name: dto.name,
                    description: (0, text_1.emptyToNull)(dto.description) ?? null,
                    maxOccupancy: dto.maxOccupancy,
                    bedConfiguration: (0, text_1.emptyToNull)(dto.bedConfiguration) ?? null,
                    amenities: dto.amenities,
                },
                include,
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'room_type.created', entity: 'room_type', entityId: row.id, after: { name: row.name } });
            return toView(row);
        });
    }
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.roomType.findFirst({ where: { id, deletedAt: null }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Room type');
            (0, assert_access_1.assertCan)(access, 'room_type.manage', existing.propertyId);
            if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
                await this.ensureNameFree(tx, existing.propertyId, dto.name);
            }
            const data = {};
            if (dto.name !== undefined)
                data.name = dto.name;
            if (dto.description !== undefined)
                data.description = (0, text_1.emptyToNull)(dto.description);
            if (dto.maxOccupancy !== undefined)
                data.maxOccupancy = dto.maxOccupancy;
            if (dto.bedConfiguration !== undefined)
                data.bedConfiguration = (0, text_1.emptyToNull)(dto.bedConfiguration);
            if (dto.amenities !== undefined)
                data.amenities = dto.amenities;
            const row = await tx.roomType.update({ where: { id }, data, include });
            const diff = (0, changed_fields_1.changedFields)(existing, row, AUDITED);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: row.propertyId, action: 'room_type.updated', entity: 'room_type', entityId: id, before: diff.before, after: diff.after });
            }
            return toView(row);
        });
    }
    async archive(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const existing = await tx.roomType.findFirst({ where: { id, deletedAt: null }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Room type');
            (0, assert_access_1.assertCan)(access, 'room_type.manage', existing.propertyId);
            if (existing._count.rooms > 0)
                throw (0, errors_1.conflict)('ROOM_TYPE_IN_USE', 'Rooms still use this type. Move or archive those rooms first.');
            await tx.roomType.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'room_type.archived', entity: 'room_type', entityId: id, before: { name: existing.name } });
        });
    }
    async requireProperty(tx, propertyId) {
        if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0)
            throw (0, errors_1.notFound)('Property');
    }
    async ensureNameFree(tx, propertyId, name) {
        const clash = await tx.roomType.findFirst({ where: { propertyId, deletedAt: null, name: { equals: name, mode: 'insensitive' } } });
        if (clash)
            throw (0, errors_1.conflict)('ROOM_TYPE_EXISTS', `A room type named "${name}" already exists at this property.`);
    }
};
exports.RoomTypesService = RoomTypesService;
exports.RoomTypesService = RoomTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RoomTypesService);
//# sourceMappingURL=room-types.service.js.map