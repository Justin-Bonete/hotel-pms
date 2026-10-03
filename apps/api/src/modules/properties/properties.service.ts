import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { PropertyDetail, PropertySummary } from '@pms/types';
import type { CreatePropertyInput, PaginationInput, UpdatePropertyInput } from '@pms/validation';
import type { AccessContext, PropertyScope } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { changedFields } from '../../common/audit/changed-fields';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { Paginated } from '../../common/http/response.interceptor';
import { emptyToNull, slugify } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PropertiesRepository, PropertyRow } from './properties.repository';

const AUDITED_FIELDS = [
  'name', 'type', 'groupId', 'addressLine1', 'addressLine2', 'city', 'region', 'postalCode',
  'country', 'phone', 'email', 'timezone', 'currency', 'checkInTime', 'checkOutTime',
] as const;

const toSummary = (p: PropertyRow): PropertySummary => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  type: p.type,
  status: p.status,
  city: p.city,
  region: p.region,
  groupName: p.group?.name ?? null,
  roomCount: p._count.rooms,
});

const toDetail = (p: PropertyRow): PropertyDetail => ({
  ...toSummary(p),
  groupId: p.groupId,
  addressLine1: p.addressLine1,
  addressLine2: p.addressLine2,
  postalCode: p.postalCode,
  country: p.country,
  phone: p.phone,
  email: p.email,
  timezone: p.timezone,
  currency: p.currency,
  checkInTime: p.checkInTime,
  checkOutTime: p.checkOutTime,
});

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PropertiesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: PaginationInput, scope: PropertyScope): Promise<Paginated<PropertySummary>> {
    const { rows, total } = await this.prisma.forTenant((tx) =>
      this.repo.list(tx, { skip: (query.page - 1) * query.pageSize, take: query.pageSize, scope }),
    );
    return new Paginated(rows.map(toSummary), { page: query.page, pageSize: query.pageSize, total });
  }

  async get(id: string, access: AccessContext): Promise<PropertyDetail> {
    assertCan(access, 'property.read', id);
    const property = await this.prisma.forTenant((tx) => this.repo.findById(tx, id));
    if (!property) throw notFound('Property');
    return toDetail(property);
  }

  async create(dto: CreatePropertyInput, access: AccessContext): Promise<PropertyDetail> {
    const created = await this.prisma.forTenant(async (tx) => {
      if (dto.groupId) await this.requireGroup(tx, dto.groupId);
      const property = await this.repo.create(tx, {
        organizationId: access.organizationId,
        slug: await this.uniqueSlug(tx, dto.name),
        name: dto.name,
        type: dto.type,
        groupId: dto.groupId || null,
        addressLine1: emptyToNull(dto.addressLine1),
        addressLine2: emptyToNull(dto.addressLine2),
        city: emptyToNull(dto.city),
        region: emptyToNull(dto.region),
        postalCode: emptyToNull(dto.postalCode),
        phone: emptyToNull(dto.phone),
        email: emptyToNull(dto.email),
        country: dto.country?.toUpperCase(),
        timezone: dto.timezone,
        currency: dto.currency?.toUpperCase(),
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
      });
      await this.audit.record(tx, {
        organizationId: access.organizationId,
        actorId: access.userId,
        propertyId: property.id,
        action: 'property.created',
        entity: 'property',
        entityId: property.id,
        after: { name: property.name, type: property.type },
      });
      return property;
    });
    return toDetail(created);
  }

  async update(id: string, dto: UpdatePropertyInput, access: AccessContext): Promise<PropertyDetail> {
    assertCan(access, 'property.update', id);
    const updated = await this.prisma.forTenant(async (tx) => {
      const existing = await this.repo.findById(tx, id);
      if (!existing) throw notFound('Property');
      if (dto.groupId) await this.requireGroup(tx, dto.groupId);

      const data: Prisma.PropertyUncheckedUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.type !== undefined) data.type = dto.type;
      if (dto.groupId !== undefined) data.groupId = dto.groupId || null;
      if (dto.addressLine1 !== undefined) data.addressLine1 = emptyToNull(dto.addressLine1);
      if (dto.addressLine2 !== undefined) data.addressLine2 = emptyToNull(dto.addressLine2);
      if (dto.city !== undefined) data.city = emptyToNull(dto.city);
      if (dto.region !== undefined) data.region = emptyToNull(dto.region);
      if (dto.postalCode !== undefined) data.postalCode = emptyToNull(dto.postalCode);
      if (dto.phone !== undefined) data.phone = emptyToNull(dto.phone);
      if (dto.email !== undefined) data.email = emptyToNull(dto.email);
      if (dto.country !== undefined) data.country = dto.country.toUpperCase();
      if (dto.timezone !== undefined) data.timezone = dto.timezone;
      if (dto.currency !== undefined) data.currency = dto.currency.toUpperCase();
      if (dto.checkInTime !== undefined) data.checkInTime = dto.checkInTime;
      if (dto.checkOutTime !== undefined) data.checkOutTime = dto.checkOutTime;

      const property = await this.repo.update(tx, id, data);
      const diff = changedFields(existing, property, AUDITED_FIELDS);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, {
          organizationId: access.organizationId,
          actorId: access.userId,
          propertyId: id,
          action: 'property.updated',
          entity: 'property',
          entityId: id,
          before: diff.before,
          after: diff.after,
        });
      }
      return property;
    });
    return toDetail(updated);
  }

  /** Archive, never hard delete. Refused while the property still has rooms. */
  async archive(id: string, access: AccessContext): Promise<void> {
    assertCan(access, 'property.delete', id);
    await this.prisma.forTenant(async (tx) => {
      const existing = await this.repo.findById(tx, id);
      if (!existing) throw notFound('Property');
      if ((await this.repo.countActiveRooms(tx, id)) > 0) {
        throw conflict('PROPERTY_HAS_ROOMS', 'This property still has rooms. Archive its rooms first.');
      }
      await this.repo.update(tx, id, { deletedAt: new Date(), status: 'INACTIVE' });
      await this.audit.record(tx, {
        organizationId: access.organizationId,
        actorId: access.userId,
        propertyId: id,
        action: 'property.archived',
        entity: 'property',
        entityId: id,
        before: { name: existing.name },
      });
    });
  }

  private async requireGroup(tx: Tx, groupId: string): Promise<void> {
    if (!(await this.repo.groupExists(tx, groupId))) throw badRequest('INVALID_GROUP', 'That property group does not exist.');
  }

  private async uniqueSlug(tx: Tx, name: string): Promise<string> {
    const base = slugify(name);
    if (!(await this.repo.slugExists(tx, base))) return base;
    for (let i = 0; i < 5; i++) {
      const candidate = `${base}-${randomBytes(2).toString('hex')}`;
      if (!(await this.repo.slugExists(tx, candidate))) return candidate;
    }
    throw conflict('SLUG_UNAVAILABLE', 'Could not create a unique address for this property. Try a different name.');
  }
}
