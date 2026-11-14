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
exports.MaintenanceService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const changed_fields_1 = require("../../common/audit/changed-fields");
const app_exception_1 = require("../../common/http/app-exception");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const housekeeping_automation_service_1 = require("../housekeeping/housekeeping-automation.service");
const rbac_service_1 = require("../rbac/rbac.service");
const realtime_service_1 = require("../realtime/realtime.service");
const include = {
    room: { select: { number: true, status: true } },
    assignedTo: { select: { firstName: true, lastName: true } },
    reportedBy: { select: { firstName: true, lastName: true } },
};
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const MANAGER_ONLY = ['assign', 'close', 'reopen'];
const label = (value) => value.toLowerCase().replace(/_/g, ' ');
const name = (u) => (u ? `${u.firstName} ${u.lastName}` : null);
const toView = (t) => ({
    id: t.id,
    propertyId: t.propertyId,
    roomId: t.roomId,
    roomNumber: t.room?.number ?? null,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    blocksRoom: t.blocksRoom,
    assignedToId: t.assignedToId,
    assignedToName: name(t.assignedTo),
    reportedByName: name(t.reportedBy),
    costMinor: t.costMinor,
    minutesSpent: t.minutesSpent,
    partsUsed: t.partsUsed,
    resolutionNote: t.resolutionNote,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
});
let MaintenanceService = class MaintenanceService {
    prisma;
    audit;
    rbac;
    realtime;
    housekeeping;
    constructor(prisma, audit, rbac, realtime, housekeeping) {
        this.prisma = prisma;
        this.audit = audit;
        this.rbac = rbac;
        this.realtime = realtime;
        this.housekeeping = housekeeping;
    }
    async list(propertyId, query, access) {
        (0, assert_access_1.assertCan)(access, 'maintenance.read', propertyId);
        const where = {
            propertyId,
            ...(query.status ? { status: query.status } : {}),
            ...(query.open === 'true' ? { status: { in: [...types_1.OPEN_MAINTENANCE_STATUSES] } } : {}),
            ...(query.mine === 'true' ? { assignedToId: access.userId } : {}),
        };
        const rows = await this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            return tx.maintenanceTicket.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 500 });
        });
        return rows.map(toView).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt));
    }
    async staff(propertyId, access) {
        (0, assert_access_1.assertCan)(access, 'maintenance.manage', propertyId);
        return this.prisma.forTenant((tx) => this.rbac.assignableStaff(tx, propertyId, 'maintenance.work'));
    }
    async create(propertyId, dto, access) {
        (0, assert_access_1.assertCan)(access, 'maintenance.report', propertyId);
        return this.prisma.forTenant(async (tx) => {
            await this.requireProperty(tx, propertyId);
            if (dto.blocksRoom && !dto.roomId)
                throw (0, errors_1.badRequest)('ROOM_REQUIRED', 'Choose the room to take out of service.');
            let roomNumber = null;
            let roomMoved = false;
            if (dto.roomId) {
                const room = await tx.room.findFirst({ where: { id: dto.roomId, propertyId, deletedAt: null } });
                if (!room)
                    throw (0, errors_1.badRequest)('INVALID_ROOM', 'That room does not belong to this property.');
                roomNumber = room.number;
                if (dto.blocksRoom)
                    roomMoved = await this.blockRoom(tx, access, propertyId, room, `Maintenance: ${dto.title}`);
            }
            const ticket = await tx.maintenanceTicket.create({
                data: {
                    organizationId: access.organizationId,
                    propertyId,
                    roomId: dto.roomId ?? null,
                    title: dto.title,
                    description: (0, text_1.emptyToNull)(dto.description) ?? null,
                    category: dto.category,
                    priority: dto.priority,
                    blocksRoom: dto.blocksRoom,
                    reportedById: access.userId,
                },
                include,
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'maintenance.reported', entity: 'maintenance_ticket', entityId: ticket.id, after: { title: dto.title, category: dto.category, priority: dto.priority, room: roomNumber, blocksRoom: dto.blocksRoom } });
            this.realtime.emit(access.organizationId, 'maintenance.changed', propertyId, [ticket.id]);
            if (roomMoved && dto.roomId)
                this.realtime.emit(access.organizationId, 'room.changed', propertyId, [dto.roomId]);
            return toView(ticket);
        });
    }
    async action(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const t = await tx.maintenanceTicket.findFirst({ where: { id }, include });
            if (!t)
                throw (0, errors_1.notFound)('Maintenance ticket');
            (0, assert_access_1.assertCan)(access, 'maintenance.read', t.propertyId);
            const manager = access.can('maintenance.manage', t.propertyId);
            const worker = access.can('maintenance.work', t.propertyId);
            const mine = worker && t.assignedToId === access.userId;
            if (MANAGER_ONLY.includes(dto.action)) {
                if (!manager)
                    throw new app_exception_1.AppException('FORBIDDEN', 'Only a manager can do this.', common_1.HttpStatus.FORBIDDEN);
            }
            else if (dto.action === 'start') {
                if (!manager && !(worker && (t.assignedToId === null || mine)))
                    throw new app_exception_1.AppException('FORBIDDEN', 'This ticket is assigned to someone else.', common_1.HttpStatus.FORBIDDEN);
            }
            else if (!manager && !mine) {
                throw new app_exception_1.AppException('FORBIDDEN', 'Only the technician it is assigned to (or a manager) can do this.', common_1.HttpStatus.FORBIDDEN);
            }
            if (!types_1.MT_ACTION_FROM[dto.action].includes(t.status)) {
                throw (0, errors_1.conflict)('INVALID_TRANSITION', `This ticket is ${label(t.status)}, so you can't ${label(dto.action)}.`);
            }
            const now = new Date();
            const result = types_1.MT_ACTION_RESULT[dto.action];
            const data = { status: result };
            let roomMoved = false;
            switch (dto.action) {
                case 'assign':
                    if (!dto.assignedToId)
                        throw (0, errors_1.badRequest)('ASSIGNEE_REQUIRED', 'Choose who should fix this.');
                    if (!(await this.rbac.assignableStaff(tx, t.propertyId, 'maintenance.work')).some((s) => s.id === dto.assignedToId)) {
                        throw (0, errors_1.badRequest)('INVALID_ASSIGNEE', 'That person is not maintenance staff at this property.');
                    }
                    data.assignedToId = dto.assignedToId;
                    data.assignedAt = now;
                    break;
                case 'start':
                    data.startedAt = t.startedAt ?? now;
                    if (t.assignedToId === null && worker) {
                        data.assignedToId = access.userId;
                        data.assignedAt = now;
                    }
                    break;
                case 'resolve': {
                    const note = (0, text_1.emptyToNull)(dto.note) ?? t.resolutionNote;
                    if (!note || note.length < 3)
                        throw (0, errors_1.badRequest)('RESOLUTION_REQUIRED', 'Describe what was done to fix it.');
                    data.resolutionNote = note;
                    data.resolvedAt = now;
                    if (t.blocksRoom && t.roomId)
                        roomMoved = await this.releaseRoom(tx, access, t, now);
                    break;
                }
                case 'close':
                    data.closedAt = now;
                    break;
                case 'reopen':
                    data.resolvedAt = null;
                    data.closedAt = null;
                    if (t.blocksRoom && t.roomId) {
                        const room = await tx.room.findFirst({ where: { id: t.roomId } });
                        if (room)
                            roomMoved = await this.blockRoom(tx, access, t.propertyId, room, `Maintenance reopened: ${t.title}`, false);
                    }
                    break;
                case 'wait_parts':
                case 'resume':
                    break;
            }
            const updated = await tx.maintenanceTicket.updateMany({ where: { id, status: t.status }, data });
            if (updated.count === 0)
                throw (0, errors_1.conflict)('TICKET_CHANGED', 'Someone else just changed this ticket. Refresh and try again.');
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: t.propertyId, action: `maintenance.${dto.action}`, entity: 'maintenance_ticket', entityId: id, before: { title: t.title, status: t.status }, after: { status: result, assignedTo: dto.assignedToId ?? null, note: (0, text_1.emptyToNull)(dto.note) ?? null } });
            this.realtime.emit(access.organizationId, 'maintenance.changed', t.propertyId, [id]);
            if (roomMoved && t.roomId)
                this.realtime.emit(access.organizationId, 'room.changed', t.propertyId, [t.roomId]);
            return toView(await tx.maintenanceTicket.findFirstOrThrow({ where: { id }, include }));
        });
    }
    /** Log work done: cost (whole centavos), time, parts. Priority changes are for managers. */
    async logWork(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const t = await tx.maintenanceTicket.findFirst({ where: { id }, include });
            if (!t)
                throw (0, errors_1.notFound)('Maintenance ticket');
            (0, assert_access_1.assertCan)(access, 'maintenance.read', t.propertyId);
            const manager = access.can('maintenance.manage', t.propertyId);
            const mine = access.can('maintenance.work', t.propertyId) && t.assignedToId === access.userId;
            if (!manager && !mine)
                throw new app_exception_1.AppException('FORBIDDEN', 'Only the assigned technician (or a manager) can update this ticket.', common_1.HttpStatus.FORBIDDEN);
            if (t.status === 'CLOSED')
                throw (0, errors_1.conflict)('TICKET_CLOSED', 'This ticket is closed. Reopen it to change it.');
            if (dto.priority !== undefined && !manager)
                throw new app_exception_1.AppException('FORBIDDEN', 'Only a manager can change the priority.', common_1.HttpStatus.FORBIDDEN);
            const data = {};
            if (dto.costMinor !== undefined)
                data.costMinor = dto.costMinor;
            if (dto.minutesSpent !== undefined)
                data.minutesSpent = dto.minutesSpent;
            if (dto.partsUsed !== undefined)
                data.partsUsed = (0, text_1.emptyToNull)(dto.partsUsed);
            if (dto.resolutionNote !== undefined)
                data.resolutionNote = (0, text_1.emptyToNull)(dto.resolutionNote);
            if (dto.priority !== undefined)
                data.priority = dto.priority;
            const row = await tx.maintenanceTicket.update({ where: { id }, data, include });
            const diff = (0, changed_fields_1.changedFields)(t, row, ['costMinor', 'minutesSpent', 'partsUsed', 'resolutionNote', 'priority']);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: t.propertyId, action: 'maintenance.work_logged', entity: 'maintenance_ticket', entityId: id, before: diff.before, after: diff.after });
                this.realtime.emit(access.organizationId, 'maintenance.changed', t.propertyId, [id]);
            }
            return toView(row);
        });
    }
    // ================================================================ room side effects
    /** Hold the room out of service while it is repaired. Refuses if a guest is in it. Returns whether the room changed. */
    async blockRoom(tx, access, propertyId, room, note, refuseIfOccupied = true) {
        if (await tx.reservation.count({ where: { roomId: room.id, status: 'CHECKED_IN' } })) {
            if (refuseIfOccupied)
                throw (0, errors_1.conflict)('ROOM_OCCUPIED', `Room ${room.number} has a guest in it. Move the guest first, or report the problem without taking the room out of service.`);
            return false;
        }
        if (room.status === 'MAINTENANCE' || !(0, types_1.canTransition)(room.status, 'MAINTENANCE'))
            return false;
        const moved = await tx.room.updateMany({ where: { id: room.id, status: room.status }, data: { status: 'MAINTENANCE', statusNote: note, statusChangedAt: new Date() } });
        if (moved.count === 0)
            return false;
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'room.status_changed', entity: 'room', entityId: room.id, before: { number: room.number, status: room.status }, after: { number: room.number, status: 'MAINTENANCE', note } });
        return true;
    }
    /** Repair finished: if no other open ticket still holds the room, it needs cleaning before it can be sold. */
    async releaseRoom(tx, access, t, now) {
        if (!t.roomId)
            return false;
        const stillBlocked = await tx.maintenanceTicket.count({ where: { roomId: t.roomId, blocksRoom: true, id: { not: t.id }, status: { in: [...types_1.OPEN_MAINTENANCE_STATUSES] } } });
        if (stillBlocked > 0)
            return false;
        const moved = await tx.room.updateMany({ where: { id: t.roomId, status: 'MAINTENANCE' }, data: { status: 'DIRTY', statusNote: 'Repair finished, needs cleaning', statusChangedAt: now } });
        if (moved.count === 0)
            return false;
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: t.propertyId, action: 'room.status_changed', entity: 'room', entityId: t.roomId, before: { number: t.room?.number ?? '', status: 'MAINTENANCE' }, after: { number: t.room?.number ?? '', status: 'DIRTY', note: `Repair finished: ${t.title}` } });
        const property = await tx.property.findFirst({ where: { id: t.propertyId }, select: { timezone: true } });
        await this.housekeeping.createCheckoutTask(tx, { organizationId: access.organizationId, propertyId: t.propertyId, roomId: t.roomId, today: (0, types_1.todayIn)(property?.timezone ?? 'UTC'), createdById: access.userId, notes: `After maintenance: ${t.title}.` });
        return true;
    }
    async requireProperty(tx, propertyId) {
        if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0)
            throw (0, errors_1.notFound)('Property');
    }
};
exports.MaintenanceService = MaintenanceService;
exports.MaintenanceService = MaintenanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        rbac_service_1.RbacService,
        realtime_service_1.RealtimeService,
        housekeeping_automation_service_1.HousekeepingAutomation])
], MaintenanceService);
//# sourceMappingURL=maintenance.service.js.map