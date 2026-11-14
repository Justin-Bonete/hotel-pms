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
exports.BuildingsService = void 0;
const common_1 = require("@nestjs/common");
const assert_access_1 = require("../../common/access/assert-access");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const include = { floors: { orderBy: { level: 'asc' } } };
let BuildingsService = class BuildingsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async structure(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'property.read', propertyId);
        const buildings = await this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            return tx.building.findMany({ where: { propertyId }, orderBy: { name: 'asc' }, include });
        });
        return buildings.map((b) => ({
            id: b.id,
            name: b.name,
            floors: b.floors.map((f) => ({ id: f.id, level: f.level, name: f.name })),
        }));
    }
    async addBuilding(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'property.update', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            const clash = await tx.building.findFirst({ where: { propertyId, name: { equals: dto.name, mode: 'insensitive' } } });
            if (clash)
                throw (0, errors_1.conflict)('BUILDING_EXISTS', `A building named "${dto.name}" already exists here.`);
            const b = await tx.building.create({ data: { organizationId: access.organizationId, propertyId, name: dto.name }, include });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'building.created', entity: 'building', entityId: b.id, after: { name: b.name } });
            return { id: b.id, name: b.name, floors: [] };
        });
    }
    async addFloor(propertyId, buildingId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'property.update', propertyId);
        return this.prisma.forTenant(async (tx) => {
            const building = await tx.building.findFirst({ where: { id: buildingId, propertyId } });
            if (!building)
                throw (0, errors_1.notFound)('Building');
            const clash = await tx.floor.findFirst({ where: { buildingId, level: dto.level } });
            if (clash)
                throw (0, errors_1.conflict)('FLOOR_EXISTS', `Floor ${dto.level} already exists in ${building.name}.`);
            const f = await tx.floor.create({
                data: { organizationId: access.organizationId, buildingId, level: dto.level, name: (0, text_1.emptyToNull)(dto.name) ?? null },
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'floor.created', entity: 'floor', entityId: f.id, after: { building: building.name, level: f.level } });
            return { id: f.id, level: f.level, name: f.name };
        });
    }
    async requireProperty(tx, propertyId) {
        if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0)
            throw (0, errors_1.notFound)('Property');
    }
};
exports.BuildingsService = BuildingsService;
exports.BuildingsService = BuildingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], BuildingsService);
//# sourceMappingURL=buildings.service.js.map