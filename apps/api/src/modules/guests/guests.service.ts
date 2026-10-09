import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { GuestDetail, GuestView } from '@pms/types';
import type { GuestInput, GuestsQuery, UpdateGuestInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { changedFields } from '../../common/audit/changed-fields';
import { conflict, notFound } from '../../common/http/errors';
import { Paginated } from '../../common/http/response.interceptor';
import { emptyToNull } from '../../common/text/text';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { reservationInclude, toReservationView } from '../reservations/reservation.mapper';

const include = { _count: { select: { reservations: { where: { status: 'CHECKED_OUT' } } } } } satisfies Prisma.GuestInclude;
type Row = Prisma.GuestGetPayload<{ include: typeof include }>;

const toView = (g: Row): GuestView => ({
  id: g.id,
  firstName: g.firstName,
  lastName: g.lastName,
  fullName: `${g.firstName} ${g.lastName}`,
  email: g.email,
  phone: g.phone,
  country: g.country,
  isVip: g.isVip,
  stayCount: g._count.reservations,
});

const AUDITED = ['firstName', 'lastName', 'email', 'phone', 'country', 'preferences', 'notes', 'isVip'] as const;

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: GuestsQuery): Promise<Paginated<GuestView>> {
    const tokens = (query.search ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
    const where: Prisma.GuestWhereInput = {
      deletedAt: null,
      AND: tokens.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: 'insensitive' as const } },
          { lastName: { contains: t, mode: 'insensitive' as const } },
          { email: { contains: t, mode: 'insensitive' as const } },
          { phone: { contains: t } },
        ],
      })),
    };
    const { rows, total } = await this.prisma.forTenant(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.guest.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, include }),
        tx.guest.count({ where }),
      ]);
      return { rows, total };
    });
    return new Paginated(rows.map(toView), { page: query.page, pageSize: query.pageSize, total });
  }

  /** Opening a profile is itself audited (privacy). Stays are limited to properties the caller may see. */
  async get(id: string, access: AccessContext): Promise<GuestDetail> {
    return this.prisma.forTenant(async (tx) => {
      const g = await tx.guest.findFirst({ where: { id, deletedAt: null }, include });
      if (!g) throw notFound('Guest');

      const scope = access.scopeOf('reservation.read');
      const stays =
        !scope.all && scope.ids.size === 0
          ? []
          : await tx.reservation.findMany({
              where: { guestId: id, ...(scope.all ? {} : { propertyId: { in: [...scope.ids] } }) },
              orderBy: { arrivalDate: 'desc' },
              take: 20,
              include: reservationInclude,
            });

      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.viewed', entity: 'guest', entityId: id });
      return { ...toView(g), notes: g.notes, preferences: g.preferences, createdAt: g.createdAt.toISOString(), stays: stays.map(toReservationView) };
    });
  }

  async create(dto: GuestInput, access: AccessContext): Promise<GuestView> {
    return this.prisma.forTenant(async (tx) => {
      await this.ensureEmailFree(tx, dto.email);
      const g = await tx.guest.create({
        data: {
          organizationId: access.organizationId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: emptyToNull(dto.email) ?? null,
          phone: emptyToNull(dto.phone) ?? null,
          country: emptyToNull(dto.country)?.toUpperCase() ?? null,
          preferences: emptyToNull(dto.preferences) ?? null,
          notes: emptyToNull(dto.notes) ?? null,
          isVip: dto.isVip,
        },
        include,
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.created', entity: 'guest', entityId: g.id, after: { name: `${g.firstName} ${g.lastName}` } });
      return toView(g);
    });
  }

  async update(id: string, dto: UpdateGuestInput, access: AccessContext): Promise<GuestView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await tx.guest.findFirst({ where: { id, deletedAt: null }, include });
      if (!existing) throw notFound('Guest');
      if (dto.email !== undefined && (emptyToNull(dto.email) ?? null)?.toLowerCase() !== existing.email?.toLowerCase()) {
        await this.ensureEmailFree(tx, dto.email, id);
      }
      const data: Prisma.GuestUncheckedUpdateInput = {};
      if (dto.firstName !== undefined) data.firstName = dto.firstName;
      if (dto.lastName !== undefined) data.lastName = dto.lastName;
      if (dto.email !== undefined) data.email = emptyToNull(dto.email);
      if (dto.phone !== undefined) data.phone = emptyToNull(dto.phone);
      if (dto.country !== undefined) data.country = emptyToNull(dto.country)?.toUpperCase() ?? null;
      if (dto.preferences !== undefined) data.preferences = emptyToNull(dto.preferences);
      if (dto.notes !== undefined) data.notes = emptyToNull(dto.notes);
      if (dto.isVip !== undefined) data.isVip = dto.isVip;

      const g = await tx.guest.update({ where: { id }, data, include });
      const diff = changedFields(existing, g, AUDITED);
      if (diff.changed.length > 0) {
        await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.updated', entity: 'guest', entityId: id, before: diff.before, after: diff.after });
      }
      return toView(g);
    });
  }

  private async ensureEmailFree(tx: Tx, email: string | undefined, exceptId?: string): Promise<void> {
    const value = emptyToNull(email);
    if (!value) return;
    const clash = await tx.guest.findFirst({
      where: { email: { equals: value, mode: 'insensitive' }, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw conflict('GUEST_EMAIL_EXISTS', 'A guest with this email already exists. Search for them instead of adding a duplicate.');
  }
}
