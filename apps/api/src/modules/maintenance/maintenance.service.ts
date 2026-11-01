import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  MT_ACTION_FROM,
  MT_ACTION_RESULT,
  OPEN_MAINTENANCE_STATUSES,
  canTransition,
  todayIn,
  type AssignableStaff,
  type MaintenanceTicketView,
  type RoomStatus,
  type TaskPriority,
} from '@pms/types';
import type { CreateTicketInput, TicketActionInput, TicketWorkInput, TicketsQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HousekeepingAutomation } from '../housekeeping/housekeeping-automation.service';
import { RbacService } from '../rbac/rbac.service';
import { RealtimeService } from '../realtime/realtime.service';

const include = {
  room: { select: { number: true, status: true } },
  assignedTo: { select: { firstName: true, lastName: true } },
  reportedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.MaintenanceTicketInclude;
type Row = Prisma.MaintenanceTicketGetPayload<{ include: typeof include }>;

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const MANAGER_ONLY = ['assign', 'close', 'reopen'];
const label = (value: string): string => value.toLowerCase().replace(/_/g, ' ');
const name = (u: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}` : null);

const toView = (t: Row): MaintenanceTicketView => ({
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

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly realtime: RealtimeService,
    private readonly housekeeping: HousekeepingAutomation,
  ) {}

  async list(propertyId: string, query: TicketsQuery, access: AccessContext): Promise<MaintenanceTicketView[]> {
    assertCan(access, 'maintenance.read', propertyId);
    const where: Prisma.MaintenanceTicketWhereInput = {
      propertyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.open === 'true' ? { status: { in: [...OPEN_MAINTENANCE_STATUSES] } } : {}),
      ...(query.mine === 'true' ? { assignedToId: access.userId } : {}),
    };
    const rows = await this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      return tx.maintenanceTicket.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 500 });
    });
    return rows.map(toView).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt));
  }

  async staff(propertyId: string, access: AccessContext): Promise<AssignableStaff[]> {
    assertCan(access, 'maintenance.manage', propertyId);
    return this.prisma.forTenant((tx) => this.rbac.assignableStaff(tx, propertyId, 'maintenance.work'));
  }

  async create(propertyId: string, dto: CreateTicketInput, access: AccessContext): Promise<MaintenanceTicketView> {
    assertCan(access, 'maintenance.report', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      if (dto.blocksRoom && !dto.roomId) throw badRequest('ROOM_REQUIRED', 'Choose the room to take out of service.');

      let roomNumber: string | null = null;
      let roomMoved = false;
      if (dto.roomId) {
        const room = await tx.room.findFirst({ where: { id: dto.roomId, propertyId, deletedAt: null } });
        if (!room) throw badRequest('INVALID_ROOM', 'That room does not belong to this property.');
        roomNumber = room.number;
        if (dto.blocksRoom) roomMoved = await this.blockRoom(tx, access, propertyId, room, `Maintenance: ${dto.title}`);
      }

      const ticket = await tx.maintenanceTicket.create({
        data: {
          organizationId: access.organizationId,
          propertyId,
          roomId: dto.roomId ?? null,
          title: dto.title,
          description: emptyToNull(dto.description) ?? null,
          category: dto.category,
          priority: dto.priority,
          blocksRoom: dto.blocksRoom,
          reportedById: access.userId,
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'maintenance.reported', entity: 'maintenance_ticket', entityId: ticket.id, after: { title: dto.title, category: dto.category, priority: dto.priority, room: roomNumber, blocksRoom: dto.blocksRoom } });
      this.realtime.emit(access.organizationId, 'maintenance.changed', propertyId, [ticket.id]);
      if (roomMoved && dto.roomId) this.realtime.emit(access.organizationId, 'room.changed', propertyId, [dto.roomId]);
      return toView(ticket);
    });
  }

  async action(id: string, dto: TicketActionInput, access: AccessContext): Promise<MaintenanceTicketView> {
    return this.prisma.forTenant(async (tx) => {
      const t = await tx.maintenanceTicket.findFirst({ where: { id }, include });
      if (!t) throw notFound('Maintenance ticket');
      assertCan(access, 'maintenance.read', t.propertyId);

      const manager = access.can('maintenance.manage', t.propertyId);
      const worker = access.can('maintenance.work', t.propertyId);
      const mine = worker && t.assignedToId === access.userId;
      if (MANAGER_ONLY.includes(dto.action)) {
        if (!manager) throw new AppException('FORBIDDEN', 'Only a manager can do this.', HttpStatus.FORBIDDEN);
      } else if (dto.action === 'start') {
        if (!manager && !(worker && (t.assignedToId === null || mine))) throw new AppException('FORBIDDEN', 'This ticket is assigned to someone else.', HttpStatus.FORBIDDEN);
      } else if (!manager && !mine) {
        throw new AppException('FORBIDDEN', 'Only the technician it is assigned to (or a manager) can do this.', HttpStatus.FORBIDDEN);
      }
      if (!MT_ACTION_FROM[dto.action].includes(t.status)) {
        throw conflict('INVALID_TRANSITION', `This ticket is ${label(t.status)}, so you can't ${label(dto.action)}.`);
      }

      const now = new Date();
      const result = MT_ACTION_RESULT[dto.action];
      const data: Prisma.MaintenanceTicketUncheckedUpdateInput = { status: result };
      let roomMoved = false;

      switch (dto.action) {
        case 'assign':
          if (!dto.assignedToId) throw badRequest('ASSIGNEE_REQUIRED', 'Choose who should fix this.');
          if (!(await this.rbac.assignableStaff(tx, t.propertyId, 'maintenance.work')).some((s) => s.id === dto.assignedToId)) {
            throw badRequest('INVALID_ASSIGNEE', 'That person is not maintenance staff at this property.');
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
          const note = emptyToNull(dto.note) ?? t.resolutionNote;
          if (!note || note.length < 3) throw badRequest('RESOLUTION_REQUIRED', 'Describe what was done to fix it.');
          data.resolutionNote = note;
          data.resolvedAt = now;
          if (t.blocksRoom && t.roomId) roomMoved = await this.releaseRoom(tx, access, t, now);
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
            if (room) roomMoved = await this.blockRoom(tx, access, t.propertyId, room, `Maintenance reopened: ${t.title}`, false);
          }
          break;
        case 'wait_parts':
        case 'resume':
          break;
      }

      const updated = await tx.maintenanceTicket.updateMany({ where: { id, status: t.status }, data });
      if (updated.count === 0) throw conflict('TICKET_CHANGED', 'Someone else just changed this ticket. Refresh and try again.');
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: t.propertyId, action: `maintenance.${dto.action}`, entity: 'maintenance_ticket', entityId: id, before: { title: t.title, status: t.status }, after: { status: result, assignedTo: dto.assignedToId ?? null, note: emptyToNull(dto.note) ?? null } });

      this.realtime.emit(access.organizationId, 'maintenance.changed', t.propertyId, [id]);
      if (roomMoved && t.roomId) this.realtime.emit(access.organizationId, 'room.changed', t.propertyId, [t.roomId]);
      return toView(await tx.maintenanceTicket.findFirstOrThrow({ where: { id }, include }));
    });
  }

  /** Log work done: cost (whole centavos), time, parts. Priority changes are for managers. */
  async logWork(id: string, dto: TicketWorkInput, access: AccessContext): Promise<MaintenanceTicketView> {
    return this.prisma.forTenant(async (tx) => {
      const t = await tx.maintenanceTicket.findFirst({ where: { id }, include });
      if (!t) throw notFound('Maintenance ticket');
      assertCan(access, 'maintenance.read', t.propertyId);
      const manager = access.can('maintenance.manage', t.propertyId);
      const mine = access.can('maintenance.work', t.propertyId) && t.assignedToId === access.userId;
      if (!manager && !mine) throw new AppException('FORBIDDEN', 'Only the assigned technician (or a manager) can update this ticket.', HttpStatus.FORBIDDEN);
      if (t.status === 'CLOSED') throw conflict('TICKET_CLOSED', 'This ticket is closed. Reopen it to change it.');
      if (dto.priority !== undefined && !manager) throw new AppException('FORBIDDEN', 'Only a manager can change the priority.', HttpStatus.FORBIDDEN);

      const data: Prisma.MaintenanceTicketUncheckedUpdateInput = {};
      if (dto.costMinor !== undefined) data.costMinor = dto.costMinor;
      if (dto.minutesSpent !== undefined) data.minutesSpent = dto.minutesSpent;
      if (dto.partsUsed !== undefined) data.partsUsed = emptyToNull(dto.partsUsed);
      if (dto.resolutionNote !== undefined) data.resolutionNote = emptyToNull(dto.resolutionNote);
      if (dto.priority !== undefined) data.priority = dto.priority;

      const row = await tx.maintenanceTicket.update({ where: { id }, data, include });
      const diff = changedFields(t, row, ['costMinor', 'minutesSpent', 'partsUsed', 'resolutionNote', 'priority'] as const);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: t.propertyId, action: 'maintenance.work_logged', entity: 'maintenance_ticket', entityId: id, before: diff.before, after: diff.after });
        this.realtime.emit(access.organizationId, 'maintenance.changed', t.propertyId, [id]);
      }
      return toView(row);
    });
  }

  // ================================================================ room side effects
  /** Hold the room out of service while it is repaired. Refuses if a guest is in it. Returns whether the room changed. */
  private async blockRoom(tx: Tx, access: AccessContext, propertyId: string, room: { id: string; number: string; status: RoomStatus }, note: string, refuseIfOccupied = true): Promise<boolean> {
    if (await tx.reservation.count({ where: { roomId: room.id, status: 'CHECKED_IN' } })) {
      if (refuseIfOccupied) throw conflict('ROOM_OCCUPIED', `Room ${room.number} has a guest in it. Move the guest first, or report the problem without taking the room out of service.`);
      return false;
    }
    if (room.status === 'MAINTENANCE' || !canTransition(room.status, 'MAINTENANCE')) return false;
    const moved = await tx.room.updateMany({ where: { id: room.id, status: room.status }, data: { status: 'MAINTENANCE', statusNote: note, statusChangedAt: new Date() } });
    if (moved.count === 0) return false;
    await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'room.status_changed', entity: 'room', entityId: room.id, before: { number: room.number, status: room.status }, after: { number: room.number, status: 'MAINTENANCE', note } });
    return true;
  }

  /** Repair finished: if no other open ticket still holds the room, it needs cleaning before it can be sold. */
  private async releaseRoom(tx: Tx, access: AccessContext, t: Row, now: Date): Promise<boolean> {
    if (!t.roomId) return false;
    const stillBlocked = await tx.maintenanceTicket.count({ where: { roomId: t.roomId, blocksRoom: true, id: { not: t.id }, status: { in: [...OPEN_MAINTENANCE_STATUSES] } } });
    if (stillBlocked > 0) return false;
    const moved = await tx.room.updateMany({ where: { id: t.roomId, status: 'MAINTENANCE' }, data: { status: 'DIRTY', statusNote: 'Repair finished, needs cleaning', statusChangedAt: now } });
    if (moved.count === 0) return false;
    await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: t.propertyId, action: 'room.status_changed', entity: 'room', entityId: t.roomId, before: { number: t.room?.number ?? '', status: 'MAINTENANCE' }, after: { number: t.room?.number ?? '', status: 'DIRTY', note: `Repair finished: ${t.title}` } });
    const property = await tx.property.findFirst({ where: { id: t.propertyId }, select: { timezone: true } });
    await this.housekeeping.createCheckoutTask(tx, { organizationId: access.organizationId, propertyId: t.propertyId, roomId: t.roomId, today: todayIn(property?.timezone ?? 'UTC'), createdById: access.userId, notes: `After maintenance: ${t.title}.` });
    return true;
  }

  private async requireProperty(tx: Tx, propertyId: string): Promise<void> {
    if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0) throw notFound('Property');
  }
}
