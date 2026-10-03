import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RoomTypeView } from '@pms/types';
import type { RoomTypeInput, UpdateRoomTypeInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = { _count: { select: { rooms: { where: { deletedAt: null } } } } } satisfies Prisma.RoomTypeInclude;
type Row = Prisma.RoomTypeGetPayload<{ include: typeof include }>;

const toView = (r: Row): RoomTypeView => ({
  id: r.id,
  propertyId: r.propertyId,
  name: r.name,
  description: r.description,
  maxOccupancy: r.maxOccupancy,
  bedConfiguration: r.bedConfiguration,
  amenities: r.amenities,
  roomCount: r._count.rooms,
});

const AUDITED = ['name', 'description', 'maxOccupancy', 'bedConfiguration', 'amenities'] as const;

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string, access: AccessContext): Promise<RoomTypeView[]> {
    assertCan(access, 'room.read', propertyId);
    const rows = await this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      return tx.roomType.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' }, include });
    });
    return rows.map(toView);
  }

  async create(propertyId: string, dto: RoomTypeInput, access: AccessContext): Promise<RoomTypeView> {
    assertCan(access, 'room_type.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      await this.ensureNameFree(tx, propertyId, dto.name);
      const row = await tx.roomType.create({
        data: {
          organizationId: access.organizationId,
          propertyId,
          name: dto.name,
          description: emptyToNull(dto.description) ?? null,
          maxOccupancy: dto.maxOccupancy,
          bedConfiguration: emptyToNull(dto.bedConfiguration) ?? null,
          amenities: dto.amenities,
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'room_type.created', entity: 'room_type', entityId: row.id, after: { name: row.name } });
      return toView(row);
    });
  }

  async update(id: string, dto: UpdateRoomTypeInput, access: AccessContext): Promise<RoomTypeView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.roomType.findFirst({ where: { id, deletedAt: null }, include });
      if (!existing) throw notFound('Room type');
      assertCan(access, 'room_type.manage', existing.propertyId);
      if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
        await this.ensureNameFree(tx, existing.propertyId, dto.name);
      }
      const data: Prisma.RoomTypeUncheckedUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = emptyToNull(dto.description);
      if (dto.maxOccupancy !== undefined) data.maxOccupancy = dto.maxOccupancy;
      if (dto.bedConfiguration !== undefined) data.bedConfiguration = emptyToNull(dto.bedConfiguration);
      if (dto.amenities !== undefined) data.amenities = dto.amenities;

      const row = await tx.roomType.update({ where: { id }, data, include });
      const diff = changedFields(existing, row, AUDITED);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: row.propertyId, action: 'room_type.updated', entity: 'room_type', entityId: id, before: diff.before, after: diff.after });
      }
      return toView(row);
    });
  }

  async archive(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.roomType.findFirst({ where: { id, deletedAt: null }, include });
      if (!existing) throw notFound('Room type');
      assertCan(access, 'room_type.manage', existing.propertyId);
      if (existing._count.rooms > 0) throw conflict('ROOM_TYPE_IN_USE', 'Rooms still use this type. Move or archive those rooms first.');
      await tx.roomType.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'room_type.archived', entity: 'room_type', entityId: id, before: { name: existing.name } });
    });
  }

  private async requireProperty(tx: Tx, propertyId: string): Promise<void> {
    if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0) throw notFound('Property');
  }

  private async ensureNameFree(tx: Tx, propertyId: string, name: string): Promise<void> {
    const clash = await tx.roomType.findFirst({ where: { propertyId, deletedAt: null, name: { equals: name, mode: 'insensitive' } } });
    if (clash) throw conflict('ROOM_TYPE_EXISTS', `A room type named "${name}" already exists at this property.`);
  }
}
