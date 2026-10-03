import { Injectable } from '@nestjs/common';
import type { BuildingView } from '@pms/types';
import type { BuildingInput, FloorInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = { floors: { orderBy: { level: 'asc' } } } as const;

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async structure(propertyId: string, access: AccessContext): Promise<BuildingView[]> {
    assertCan(access, 'property.read', propertyId);
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

  async addBuilding(propertyId: string, dto: BuildingInput, access: AccessContext): Promise<BuildingView> {
    assertCan(access, 'property.update', propertyId);
    return this.prisma.forTenant(async (tx) => {
      await this.requireProperty(tx, propertyId);
      const clash = await tx.building.findFirst({ where: { propertyId, name: { equals: dto.name, mode: 'insensitive' } } });
      if (clash) throw conflict('BUILDING_EXISTS', `A building named "${dto.name}" already exists here.`);
      const b = await tx.building.create({ data: { organizationId: access.organizationId, propertyId, name: dto.name }, include });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'building.created', entity: 'building', entityId: b.id, after: { name: b.name } });
      return { id: b.id, name: b.name, floors: [] };
    });
  }

  async addFloor(propertyId: string, buildingId: string, dto: FloorInput, access: AccessContext) {
    assertCan(access, 'property.update', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const building = await tx.building.findFirst({ where: { id: buildingId, propertyId } });
      if (!building) throw notFound('Building');
      const clash = await tx.floor.findFirst({ where: { buildingId, level: dto.level } });
      if (clash) throw conflict('FLOOR_EXISTS', `Floor ${dto.level} already exists in ${building.name}.`);
      const f = await tx.floor.create({
        data: { organizationId: access.organizationId, buildingId, level: dto.level, name: emptyToNull(dto.name) ?? null },
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'floor.created', entity: 'floor', entityId: f.id, after: { building: building.name, level: f.level } });
      return { id: f.id, level: f.level, name: f.name };
    });
  }

  private async requireProperty(tx: Tx, propertyId: string): Promise<void> {
    if ((await tx.property.count({ where: { id: propertyId, deletedAt: null } })) === 0) throw notFound('Property');
  }
}
