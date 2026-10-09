import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RatePlanView } from '@pms/types';
import type { RatePlanInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const include = { rates: { include: { roomType: { select: { name: true } } }, orderBy: { roomType: { name: 'asc' } } } } satisfies Prisma.RatePlanInclude;
type Row = Prisma.RatePlanGetPayload<{ include: typeof include }>;

const toView = (p: Row, currency: string): RatePlanView => ({
  id: p.id,
  propertyId: p.propertyId,
  name: p.name,
  description: p.description,
  isDefault: p.isDefault,
  currency,
  rates: p.rates.map((r) => ({
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    nightlyRateMinor: r.nightlyRateMinor,
    weekendRateMinor: r.weekendRateMinor,
  })),
});

@Injectable()
export class RatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string, access: AccessContext): Promise<RatePlanView[]> {
    assertCan(access, 'rate.read', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      const plans = await tx.ratePlan.findMany({ where: { propertyId, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], include });
      return plans.map((p) => toView(p, property.currency));
    });
  }

  async create(propertyId: string, dto: RatePlanInput, access: AccessContext): Promise<RatePlanView> {
    assertCan(access, 'rate.manage', propertyId);
    return this.prisma.forTenant(async (tx) => {
      const property = await this.requireProperty(tx, propertyId);
      await this.checkRoomTypes(tx, propertyId, dto);
      await this.ensureNameFree(tx, propertyId, dto.name);

      const existingCount = await tx.ratePlan.count({ where: { propertyId, deletedAt: null } });
      const isDefault = existingCount === 0 ? true : dto.isDefault;
      if (isDefault) await tx.ratePlan.updateMany({ where: { propertyId, deletedAt: null }, data: { isDefault: false } });

      const plan = await tx.ratePlan.create({
        data: {
          organizationId: access.organizationId,
          propertyId,
          name: dto.name,
          description: emptyToNull(dto.description) ?? null,
          isDefault,
          rates: { create: dto.rates.map((r) => ({ organizationId: access.organizationId, roomTypeId: r.roomTypeId, nightlyRateMinor: r.nightlyRateMinor, weekendRateMinor: r.weekendRateMinor })) },
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId, action: 'rate_plan.created', entity: 'rate_plan', entityId: plan.id, after: { name: plan.name, isDefault } });
      return toView(plan, property.currency);
    });
  }

  /** Replaces the plan's name, description, default flag and ALL its rates. */
  async update(id: string, dto: RatePlanInput, access: AccessContext): Promise<RatePlanView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.ratePlan.findFirst({ where: { id, deletedAt: null }, include });
      if (!existing) throw notFound('Rate plan');
      assertCan(access, 'rate.manage', existing.propertyId);
      const property = await this.requireProperty(tx, existing.propertyId);
      await this.checkRoomTypes(tx, existing.propertyId, dto);
      if (dto.name.toLowerCase() !== existing.name.toLowerCase()) await this.ensureNameFree(tx, existing.propertyId, dto.name);
      if (existing.isDefault && !dto.isDefault) throw conflict('DEFAULT_REQUIRED', 'Make another plan the default instead. A property always needs one default plan.');

      if (dto.isDefault) await tx.ratePlan.updateMany({ where: { propertyId: existing.propertyId, deletedAt: null, id: { not: id } }, data: { isDefault: false } });
      await tx.ratePlanRate.deleteMany({ where: { ratePlanId: id } });
      const plan = await tx.ratePlan.update({
        where: { id },
        data: {
          name: dto.name,
          description: emptyToNull(dto.description) ?? null,
          isDefault: dto.isDefault,
          rates: { create: dto.rates.map((r) => ({ organizationId: access.organizationId, roomTypeId: r.roomTypeId, nightlyRateMinor: r.nightlyRateMinor, weekendRateMinor: r.weekendRateMinor })) },
        },
        include,
      });
      await this.audit.record(tx, {
        organizationId: access.organizationId,
        actorId: access.userId,
        propertyId: existing.propertyId,
        action: 'rate_plan.updated',
        entity: 'rate_plan',
        entityId: id,
        before: { name: existing.name, rates: existing.rates.map((r) => `${r.roomType.name}: ${r.nightlyRateMinor}/${r.weekendRateMinor ?? '-'}`) },
        after: { name: plan.name, rates: plan.rates.map((r) => `${r.roomType.name}: ${r.nightlyRateMinor}/${r.weekendRateMinor ?? '-'}`) },
      });
      return toView(plan, property.currency);
    });
  }

  async archive(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await tx.ratePlan.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound('Rate plan');
      assertCan(access, 'rate.manage', existing.propertyId);
      if (existing.isDefault) throw conflict('DEFAULT_REQUIRED', 'This is the default plan. Make another plan the default first.');
      await tx.ratePlan.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId, action: 'rate_plan.archived', entity: 'rate_plan', entityId: id, before: { name: existing.name } });
    });
  }

  private async requireProperty(tx: Tx, propertyId: string) {
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true, currency: true } });
    if (!property) throw notFound('Property');
    return property;
  }

  private async checkRoomTypes(tx: Tx, propertyId: string, dto: RatePlanInput): Promise<void> {
    const ids = [...new Set(dto.rates.map((r) => r.roomTypeId))];
    if (ids.length !== dto.rates.length) throw badRequest('DUPLICATE_RATE', 'Each room type can have only one rate in a plan.');
    const found = await tx.roomType.count({ where: { id: { in: ids }, propertyId, deletedAt: null } });
    if (found !== ids.length) throw badRequest('INVALID_ROOM_TYPE', 'One of the room types does not belong to this property.');
  }

  private async ensureNameFree(tx: Tx, propertyId: string, name: string): Promise<void> {
    const clash = await tx.ratePlan.findFirst({ where: { propertyId, deletedAt: null, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    if (clash) throw conflict('RATE_PLAN_EXISTS', `A rate plan named "${name}" already exists.`);
  }
}
