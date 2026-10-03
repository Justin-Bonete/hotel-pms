import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RESTRICTED_ROOM_STATUSES, canTransition, type RoomView } from '@pms/types';
import type { RoomInput, RoomStatusInput, RoomsQuery, UpdateRoomInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { Paginated } from '../../common/http/response.interceptor';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = {
  roomType: { select: { name: true } },
  floor: { select: { level: true, name: true, building: { select: { name: true } } } },
} satisfies Prisma.RoomInclude;
type Row = Prisma.RoomGetPayload<{ include: typeof include }>;

const toView = (r: Row): RoomView => ({
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
});

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string, query: RoomsQuery, access: AccessContext): Promise<Paginated<RoomView>> {
    assertCan(access, 'room.read', propertyId);
    const where: Prisma.RoomWhereInput = {
      propertyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.search ? { number: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const { rows, total } = await this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const [rows, total] = await Promise.all([
        tx.room.findMany({ where, orderBy: { number: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include }),
        tx.room.count({ where }),
      ]);
      return { rows, total };
    });
    return new Paginated(rows.map(toView), { page: query.page, pageSize: query.pageSize, total });
  }

  async create(propertyId: string, dto: RoomInput, access: AccessContext): Promise<RoomView> {
    assertCan(access, 'room.manage', propertyId);
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
          notes: emptyToNull(dto.notes) ?? null,
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'room.created', entity: 'room', entityId: row.id, after: { number: row.number, roomType: row.roomType.name } });
      return toView(row);
    });
  }

  async update(id: string, dto: UpdateRoomInput, access: AccessContext): Promise<RoomView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.room.findFirst({ where: { id, deletedAt: null }, include });
      if (!existing) throw notFound('Room');
      assertCan(access, 'room.manage', existing.propertyId);
      await this.checkRefs(tx, existing.propertyId, dto.roomTypeId, dto.floorId);
      if (dto.number !== undefined && dto.number.trim() !== existing.number) {
        await this.ensureNumberFree(tx, existing.propertyId, dto.number.trim());
      }
      const data: Prisma.RoomUncheckedUpdateInput = {};
      if (dto.number !== undefined) data.number = dto.number.trim();
      if (dto.roomTypeId !== undefined) data.roomTypeId = dto.roomTypeId;
      if (dto.floorId !== undefined) data.floorId = dto.floorId || null;
      if (dto.notes !== undefined) data.notes = emptyToNull(dto.notes);

      const row = await tx.room.update({ where: { id }, data, include });
      const diff = changedFields(existing, row, ['number', 'roomTypeId', 'floorId', 'notes'] as const);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: row.propertyId, action: 'room.updated', entity: 'room', entityId: id, before: diff.before, after: diff.after });
      }
      return toView(row);
    });
  }

  /** The housekeeping flow. Moving into or out of Out of order / Out of service needs room.manage. */
  async changeStatus(id: string, dto: RoomStatusInput, access: AccessContext): Promise<RoomView> {
    return this.prisma.forTenant(async (tx) => {
      const room = await tx.room.findFirst({ where: { id, deletedAt: null }, include });
      if (!room) throw notFound('Room');
      assertCan(access, 'room.update_status', room.propertyId);

      if (!canTransition(room.status, dto.status)) {
        throw conflict('INVALID_STATUS_TRANSITION', `A room cannot go from ${label(room.status)} to ${label(dto.status)} directly.`);
      }
      const restricted = RESTRICTED_ROOM_STATUSES.includes(room.status) || RESTRICTED_ROOM_STATUSES.includes(dto.status);
      if (restricted && !access.can('room.manage', room.propertyId)) {
        throw badRequest('RESTRICTED_STATUS', 'Only a manager can put a room out of order or out of service, or bring it back.');
      }

      // Compare-and-set: if someone changed the room a moment ago, refuse instead of overwriting them.
      const now = new Date();
      const result = await tx.room.updateMany({
        where: { id, status: room.status },
        data: { status: dto.status, statusNote: emptyToNull(dto.note) ?? null, statusChangedAt: now },
      });
      if (result.count === 0) throw conflict('ROOM_STATUS_CHANGED', 'Someone else just changed this room. Refresh and try again.');

      await this.audit.record(tx, {
        organizationId: access.organizationId,
        actorId: access.userId,
        propertyId: room.propertyId,
        action: 'room.status_changed',
        entity: 'room',
        entityId: id,
        before: { number: room.number, status: room.status },
        after: { number: room.number, status: dto.status, note: emptyToNull(dto.note) ?? null },
      });
      const fresh = await tx.room.findFirstOrThrow({ where: { id }, include });
      return toView(fresh);
    });
  }

  /** Archive, never hard delete. (Phase 3 will also refuse while future reservations exist.) */
  async archive(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.room.findFirst({ where: { id, deletedAt: null }, include });
      if (!existing) throw notFound('Room');
      assertCan(access, 'room.manage', existing.propertyId);
      await tx.room.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'room.archived', entity: 'room', entityId: id, before: { number: existing.number } });
    });
  }

  private async requireProperty(tx: Tx, propertyId: string): Promise<void> {
    if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0) throw notFound('Property');
  }

  private async ensureNumberFree(tx: Tx, propertyId: string, number: string): Promise<void> {
    if (await tx.room.findFirst({ where: { propertyId, number, deletedAt: null }, select: { id: true } })) {
      throw conflict('ROOM_NUMBER_TAKEN', `Room ${number} already exists at this property.`);
    }
  }

  /** Room type and floor must belong to the SAME property as the room. */
  private async checkRefs(tx: Tx, propertyId: string, roomTypeId?: string, floorId?: string): Promise<void> {
    if (roomTypeId && (await tx.roomType.count({ where: { id: roomTypeId, propertyId, deletedAt: null } })) === 0) {
      throw badRequest('INVALID_ROOM_TYPE', 'That room type does not belong to this property.');
    }
    if (floorId && (await tx.floor.count({ where: { id: floorId, building: { propertyId } } })) === 0) {
      throw badRequest('INVALID_FLOOR', 'That floor does not belong to this property.');
    }
  }
}

const label = (status: string): string => status.toLowerCase().replace(/_/g, ' ');
