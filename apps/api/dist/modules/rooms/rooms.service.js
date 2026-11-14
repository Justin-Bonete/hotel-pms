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
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const response_interceptor_1 = require("../../common/http/response.interceptor");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const realtime_service_1 = require("../realtime/realtime.service");
const include = {
    roomType: { select: { name: true } },
    floor: { select: { level: true, name: true, building: { select: { name: true } } } },
};
const toView = (r, derived = null) => ({
    id: r.id,
    propertyId: r.propertyId,
    number: r.number,
    status: r.status,
    statusNote: r.statusNote,
    statusChangedAt: r.statusChangedAt.toISOString(),
    notes: r.notes,
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    floorId: r.floorId,
    floorLevel: r.floor?.level ?? null,
    floorLabel: r.floor ? `${r.floor.building.name} · ${r.floor.name ?? `Floor ${r.floor.level}`}` : null,
    derived,
});
let RoomsService = class RoomsService {
    prisma;
    audit;
    realtime;
    constructor(prisma, audit, realtime) {
        this.prisma = prisma;
        this.audit = audit;
        this.realtime = realtime;
    }
    async list(propertyId, query, access) {
        (0, assert_access_1.assertCan)(access, 'room.read', propertyId);
        const where = {
            propertyId,
            deletedAt: null,
            ...(query.status ? { status: query.status } : {}),
            ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
            ...(query.floorId ? { floorId: query.floorId } : {}),
            ...(query.search ? { number: { contains: query.search, mode: 'insensitive' } } : {}),
        };
        const { rows, total, derived } = await this.prisma.forTenant(async (tx) => {
            const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { timezone: true } });
            if (!property)
                throw (0, errors_1.notFound)('Property');
            const [rows, total] = await Promise.all([
                tx.room.findMany({ where, orderBy: { number: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include }),
                tx.room.count({ where }),
            ]);
            // Occupied / Reserved / Due out come from today's reservations (property's own timezone).
            const today = (0, types_1.todayIn)(property.timezone);
            const ids = rows.map((r) => r.id);
            const active = ids.length
                ? await tx.reservation.findMany({
                    where: {
                        propertyId,
                        roomId: { in: ids },
                        OR: [{ status: 'CHECKED_IN' }, { status: { in: ['PENDING', 'CONFIRMED'] }, arrivalDate: (0, types_1.parseDate)(today) }],
                    },
                    select: { roomId: true, status: true, departureDate: true },
                })
                : [];
            const derived = new Map();
            for (const a of active) {
                if (!a.roomId)
                    continue;
                if (a.status === 'CHECKED_IN')
                    derived.set(a.roomId, (0, types_1.toDateString)(a.departureDate) <= today ? 'DUE_OUT' : 'OCCUPIED');
                else if (!derived.has(a.roomId))
                    derived.set(a.roomId, 'RESERVED');
            }
            return { rows, total, derived };
        });
        return new response_interceptor_1.Paginated(rows.map((r) => toView(r, derived.get(r.id) ?? null)), { page: query.page, pageSize: query.pageSize, total });
    }
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'room.manage', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            await this.checkRefs(tx, propertyId, dto.roomTypeId, dto.floorId);
            const number = dto.number.trim();
            await this.ensureNumberFree(tx, propertyId, number);
            const row = await tx.room.create({
                data: {
                    organizationId: access.organizationId,
                    propertyId,
                    roomTypeId: dto.roomTypeId,
                    floorId: dto.floorId || null,
                    number,
                    notes: (0, text_1.emptyToNull)(dto.notes) ?? null,
                },
                include,
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'room.created', entity: 'room', entityId: row.id, after: { number: row.number, roomType: row.roomType.name } });
            this.realtime.emit(access.organizationId, 'room.changed', propertyId, [row.id]);
            return toView(row);
        });
    }
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.room.findFirst({ where: { id, deletedAt: null }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Room');
            (0, assert_access_1.assertCan)(access, 'room.manage', existing.propertyId);
            await this.checkRefs(tx, existing.propertyId, dto.roomTypeId, dto.floorId);
            if (dto.number !== undefined && dto.number.trim() !== existing.number) {
                await this.ensureNumberFree(tx, existing.propertyId, dto.number.trim());
            }
            const data = {};
            if (dto.number !== undefined)
                data.number = dto.number.trim();
            if (dto.roomTypeId !== undefined)
                data.roomTypeId = dto.roomTypeId;
            if (dto.floorId !== undefined)
                data.floorId = dto.floorId || null;
            if (dto.notes !== undefined)
                data.notes = (0, text_1.emptyToNull)(dto.notes);
            const row = await tx.room.update({ where: { id }, data, include });
            const diff = (0, changed_fields_1.changedFields)(existing, row, ['number', 'roomTypeId', 'floorId', 'notes']);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: row.propertyId, action: 'room.updated', entity: 'room', entityId: id, before: diff.before, after: diff.after });
            }
            this.realtime.emit(access.organizationId, 'room.changed', row.propertyId, [id]);
            return toView(row);
        });
    }
    /** The housekeeping flow. Moving into or out of Out of order / Out of service needs room.manage. */
    async changeStatus(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const room = await tx.room.findFirst({ where: { id, deletedAt: null }, include });
            if (!room)
                throw (0, errors_1.notFound)('Room');
            (0, assert_access_1.assertCan)(access, 'room.update_status', room.propertyId);
            if (!(0, types_1.canTransition)(room.status, dto.status)) {
                throw (0, errors_1.conflict)('INVALID_STATUS_TRANSITION', `A room cannot go from ${label(room.status)} to ${label(dto.status)} directly.`);
            }
            const restricted = types_1.RESTRICTED_ROOM_STATUSES.includes(room.status) || types_1.RESTRICTED_ROOM_STATUSES.includes(dto.status);
            if (restricted && !access.can('room.manage', room.propertyId)) {
                throw (0, errors_1.badRequest)('RESTRICTED_STATUS', 'Only a manager can put a room out of order or out of service, or bring it back.');
            }
            // Compare-and-set: if someone changed the room a moment ago, refuse instead of overwriting them.
            const now = new Date();
            const result = await tx.room.updateMany({
                where: { id, status: room.status },
                data: { status: dto.status, statusNote: (0, text_1.emptyToNull)(dto.note) ?? null, statusChangedAt: now },
            });
            if (result.count === 0)
                throw (0, errors_1.conflict)('ROOM_STATUS_CHANGED', 'Someone else just changed this room. Refresh and try again.');
            await this.audit.record(tx, {
                organizationId: access.organizationId,
                actorId: access.userId,
                propertyId: room.propertyId,
                action: 'room.status_changed',
                entity: 'room',
                entityId: id,
                before: { number: room.number, status: room.status },
                after: { number: room.number, status: dto.status, note: (0, text_1.emptyToNull)(dto.note) ?? null },
            });
            this.realtime.emit(access.organizationId, 'room.changed', room.propertyId, [id]);
            const fresh = await tx.room.findFirstOrThrow({ where: { id }, include });
            return toView(fresh);
        });
    }
    /** Archive, never hard delete. (Phase 3 will also refuse while future reservations exist.) */
    async archive(id, access) {
        await this.prisma.forTenant(async (tx) => {
            const existing = await tx.room.findFirst({ where: { id, deletedAt: null }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Room');
            (0, assert_access_1.assertCan)(access, 'room.manage', existing.propertyId);
            await tx.room.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'room.archived', entity: 'room', entityId: id, before: { number: existing.number } });
        });
    }
    async requireProperty(tx, propertyId) {
        if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0)
            throw (0, errors_1.notFound)('Property');
    }
    async ensureNumberFree(tx, propertyId, number) {
        if (await tx.room.findFirst({ where: { propertyId, number, deletedAt: null }, select: { id: true } })) {
            throw (0, errors_1.conflict)('ROOM_NUMBER_TAKEN', `Room ${number} already exists at this property.`);
        }
    }
    /** Room type and floor must belong to the SAME property as the room. */
    async checkRefs(tx, propertyId, roomTypeId, floorId) {
        if (roomTypeId && (await tx.roomType.count({ where: { id: roomTypeId, propertyId, deletedAt: null } })) === 0) {
            throw (0, errors_1.badRequest)('INVALID_ROOM_TYPE', 'That room type does not belong to this property.');
        }
        if (floorId && (await tx.floor.count({ where: { id: floorId, building: { propertyId } } })) === 0) {
            throw (0, errors_1.badRequest)('INVALID_FLOOR', 'That floor does not belong to this property.');
        }
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        realtime_service_1.RealtimeService])
], RoomsService);
const label = (status) => status.toLowerCase().replace(/_/g, ' ');
//# sourceMappingURL=rooms.service.js.map