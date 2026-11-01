import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  HK_ACTION_FROM,
  OPEN_HOUSEKEEPING_STATUSES,
  housekeepingResult,
  housekeepingRoomEffect,
  parseDate,
  todayIn,
  type AssignableStaff,
  type HousekeepingTaskView,
  type TaskPriority,
} from '@pms/types';
import type { CreateTaskInput, TaskActionInput, TasksQuery } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { RealtimeService } from '../realtime/realtime.service';

const include = {
  room: { select: { number: true, status: true, roomType: { select: { name: true } }, floor: { select: { level: true, name: true, building: { select: { name: true } } } } } },
  assignedTo: { select: { firstName: true, lastName: true } },
} satisfies Prisma.HousekeepingTaskInclude;
type Row = Prisma.HousekeepingTaskGetPayload<{ include: typeof include }>;

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const MANAGER_ACTIONS = ['assign', 'unassign', 'inspect_pass', 'inspect_fail', 'cancel'];
const label = (value: string): string => value.toLowerCase().replace(/_/g, ' ');

const toView = (t: Row): HousekeepingTaskView => ({
  id: t.id,
  propertyId: t.propertyId,
  roomId: t.roomId,
  roomNumber: t.room.number,
  roomTypeName: t.room.roomType.name,
  roomStatus: t.room.status,
  floorLabel: t.room.floor ? `${t.room.floor.building.name} · ${t.room.floor.name ?? `Floor ${t.room.floor.level}`}` : null,
  type: t.type,
  status: t.status,
  priority: t.priority,
  assignedToId: t.assignedToId,
  assignedToName: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : null,
  estimatedMinutes: t.estimatedMinutes,
  notes: t.notes,
  createdAt: t.createdAt.toISOString(),
  startedAt: t.startedAt?.toISOString() ?? null,
  cleanedAt: t.cleanedAt?.toISOString() ?? null,
  completedAt: t.completedAt?.toISOString() ?? null,
});

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(propertyId: string, query: TasksQuery, access: AccessContext): Promise<HousekeepingTaskView[]> {
    assertCan(access, 'housekeeping.read', propertyId);
    const where: Prisma.HousekeepingTaskWhereInput = {
      propertyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.open === 'true' ? { status: { in: [...OPEN_HOUSEKEEPING_STATUSES] } } : {}),
      ...(query.mine === 'true' ? { assignedToId: access.userId } : {}),
    };
    const rows = await this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      return tx.housekeepingTask.findMany({ where, include, orderBy: { createdAt: 'asc' }, take: 500 });
    });
    return rows
      .map(toView)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt));
  }

  async staff(propertyId: string, access: AccessContext): Promise<AssignableStaff[]> {
    assertCan(access, 'housekeeping.manage', propertyId);
    return this.prisma.forTenant((tx) => this.rbac.assignableStaff(tx, propertyId, 'housekeeping.work'));
  }

  async create(propertyId: string, dto: CreateTaskInput, access: AccessContext): Promise<HousekeepingTaskView> {
    assertCan(access, 'housekeeping.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      if (!(await tx.room.findFirst({ where: { id: dto.roomId, propertyId, deletedAt: null }, select: { id: true } }))) {
        throw badRequest('INVALID_ROOM', 'That room does not belong to this property.');
      }
      if (dto.assignedToId) await this.requireAssignable(tx, propertyId, dto.assignedToId);
      if (await tx.housekeepingTask.findFirst({ where: { roomId: dto.roomId, type: dto.type, status: { in: [...OPEN_HOUSEKEEPING_STATUSES] } }, select: { id: true } })) {
        throw conflict('TASK_EXISTS', `This room already has an open ${label(dto.type)} task.`);
      }
      const task = await tx.housekeepingTask.create({
        data: {
          organizationId: access.organizationId,
          propertyId,
          roomId: dto.roomId,
          type: dto.type,
          priority: dto.priority,
          status: dto.assignedToId ? 'ASSIGNED' : 'OPEN',
          assignedToId: dto.assignedToId ?? null,
          assignedAt: dto.assignedToId ? new Date() : null,
          estimatedMinutes: dto.estimatedMinutes ?? null,
          notes: emptyToNull(dto.notes) ?? null,
          createdById: access.userId,
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'housekeeping.task_created', entity: 'housekeeping_task', entityId: task.id, after: { room: task.room.number, type: task.type, priority: task.priority } });
      this.realtime.emit(access.organizationId, 'housekeeping.changed', propertyId, [task.id]);
      return toView(task);
    });
  }

  /**
   * One endpoint for the whole workflow. Supervisors assign, inspect and cancel; the housekeeper it is
   * assigned to starts and finishes it. A turnover clean also moves the ROOM along (dirty -> cleaning ->
   * clean -> available) so the front desk sees it live; a stayover never touches the room.
   */
  async action(id: string, dto: TaskActionInput, access: AccessContext): Promise<HousekeepingTaskView> {
    return this.prisma.forTenant(async (tx) => {
      const task = await tx.housekeepingTask.findFirst({ where: { id }, include });
      if (!task) throw notFound('Housekeeping task');
      assertCan(access, 'housekeeping.read', task.propertyId);

      const manager = access.can('housekeeping.manage', task.propertyId);
      if (MANAGER_ACTIONS.includes(dto.action)) {
        if (!manager) throw new AppException('FORBIDDEN', 'Only a supervisor can do this.', HttpStatus.FORBIDDEN);
      } else {
        const mine = task.assignedToId === access.userId && access.can('housekeeping.work', task.propertyId);
        if (!mine && !manager) throw new AppException('FORBIDDEN', 'Only the person this task is assigned to (or a supervisor) can do this.', HttpStatus.FORBIDDEN);
      }
      if (!HK_ACTION_FROM[dto.action].includes(task.status)) {
        throw conflict('INVALID_TRANSITION', `This task is ${label(task.status)}, so you can't ${label(dto.action)}.`);
      }

      const now = new Date();
      const result = housekeepingResult(task.type, dto.action);
      const data: Prisma.HousekeepingTaskUncheckedUpdateInput = { status: result };
      switch (dto.action) {
        case 'assign':
          if (!dto.assignedToId) throw badRequest('ASSIGNEE_REQUIRED', 'Choose who should do this task.');
          await this.requireAssignable(tx, task.propertyId, dto.assignedToId);
          data.assignedToId = dto.assignedToId;
          data.assignedAt = now;
          break;
        case 'unassign':
          data.assignedToId = null;
          data.assignedAt = null;
          break;
        case 'start':
          data.startedAt = now;
          break;
        case 'finish':
          data.cleanedAt = now;
          if (result === 'DONE') data.completedAt = now;
          break;
        case 'inspect_pass':
          data.completedAt = now;
          break;
        case 'inspect_fail':
          data.cleanedAt = null;
          data.notes = [task.notes, `Failed inspection: ${emptyToNull(dto.note) ?? 'needs another pass'}`].filter(Boolean).join('\n');
          break;
        case 'cancel':
          break;
      }

      // Compare-and-set: refuse instead of overwriting if someone else just changed this task.
      const updated = await tx.housekeepingTask.updateMany({ where: { id, status: task.status }, data });
      if (updated.count === 0) throw conflict('TASK_CHANGED', 'Someone else just changed this task. Refresh and try again.');

      let roomChanged = false;
      const effect = housekeepingRoomEffect(task.type, dto.action);
      if (effect && effect.from.includes(task.room.status)) {
        const moved = await tx.room.updateMany({
          where: { id: task.roomId, status: task.room.status },
          data: { status: effect.to, statusNote: dto.action === 'inspect_fail' ? (emptyToNull(dto.note) ?? 'Failed inspection') : null, statusChangedAt: now },
        });
        roomChanged = moved.count > 0;
        if (roomChanged) {
          await this.audit.record(tx, {
            organizationId: access.organizationId,
            actorId: access.userId,
            propertyId: task.propertyId,
            action: 'room.status_changed',
            entity: 'room',
            entityId: task.roomId,
            before: { number: task.room.number, status: task.room.status },
            after: { number: task.room.number, status: effect.to, note: `Housekeeping: ${label(dto.action)}` },
          });
        }
      }
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: task.propertyId, action: `housekeeping.${dto.action}`, entity: 'housekeeping_task', entityId: id, before: { room: task.room.number, status: task.status }, after: { status: result, assignedTo: dto.assignedToId ?? null } });

      this.realtime.emit(access.organizationId, 'housekeeping.changed', task.propertyId, [id]);
      if (roomChanged) this.realtime.emit(access.organizationId, 'room.changed', task.propertyId, [task.roomId]);
      return toView(await tx.housekeepingTask.findFirstOrThrow({ where: { id }, include }));
    });
  }

  /** Daily service for guests staying on: one STAYOVER task per in-house room not leaving today. Safe to run repeatedly. */
  async generateStayovers(propertyId: string, access: AccessContext): Promise<{ created: number }> {
    assertCan(access, 'housekeeping.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { timezone: true } });
      if (!property) throw notFound('Property');
      const today = todayIn(property.timezone);
      const staying = await tx.reservation.findMany({
        where: { propertyId, status: 'CHECKED_IN', roomId: { not: null }, departureDate: { gt: parseDate(today) } },
        select: { roomId: true },
      });
      const rooms = [...new Set(staying.map((s) => s.roomId as string))];
      const created = await tx.housekeepingTask.createMany({
        data: rooms.map((roomId) => ({ organizationId: access.organizationId, propertyId, roomId, type: 'STAYOVER' as const, priority: 'LOW' as const, notes: 'Daily stayover service', createdById: access.userId })),
        skipDuplicates: true,
      });
      if (created.count > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'housekeeping.stayovers_generated', entity: 'property', entityId: propertyId, after: { created: created.count } });
        this.realtime.emit(access.organizationId, 'housekeeping.changed', propertyId, []);
      }
      return { created: created.count };
    });
  }

  private async requireProperty(tx: Tx, propertyId: string): Promise<void> {
    if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0) throw notFound('Property');
  }

  private async requireAssignable(tx: Tx, propertyId: string, userId: string): Promise<void> {
    const staff = await this.rbac.assignableStaff(tx, propertyId, 'housekeeping.work');
    if (!staff.some((s) => s.id === userId)) throw badRequest('INVALID_ASSIGNEE', 'That person is not housekeeping staff at this property.');
  }
}
