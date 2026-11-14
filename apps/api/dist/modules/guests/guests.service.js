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
exports.GuestsService = void 0;
const common_1 = require("@nestjs/common");
const changed_fields_1 = require("../../common/audit/changed-fields");
const errors_1 = require("../../common/http/errors");
const response_interceptor_1 = require("../../common/http/response.interceptor");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const reservation_mapper_1 = require("../reservations/reservation.mapper");
const include = { _count: { select: { reservations: { where: { status: 'CHECKED_OUT' } } } } };
const toView = (g) => ({
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
const AUDITED = ['firstName', 'lastName', 'email', 'phone', 'country', 'preferences', 'notes', 'isVip'];
let GuestsService = class GuestsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(query) {
        const tokens = (query.search ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
        const where = {
            deletedAt: null,
            AND: tokens.map((t) => ({
                OR: [
                    { firstName: { contains: t, mode: 'insensitive' } },
                    { lastName: { contains: t, mode: 'insensitive' } },
                    { email: { contains: t, mode: 'insensitive' } },
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
        return new response_interceptor_1.Paginated(rows.map(toView), { page: query.page, pageSize: query.pageSize, total });
    }
    /** Opening a profile is itself audited (privacy). Stays are limited to properties the caller may see. */
    async get(id, access) {
        return this.prisma.forTenant(async (tx) => {
            const g = await tx.guest.findFirst({ where: { id, deletedAt: null }, include });
            if (!g)
                throw (0, errors_1.notFound)('Guest');
            const scope = access.scopeOf('reservation.read');
            const stays = !scope.all && scope.ids.size === 0
                ? []
                : await tx.reservation.findMany({
                    where: { guestId: id, ...(scope.all ? {} : { propertyId: { in: [...scope.ids] } }) },
                    orderBy: { arrivalDate: 'desc' },
                    take: 20,
                    include: reservation_mapper_1.reservationInclude,
                });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.viewed', entity: 'guest', entityId: id });
            return { ...toView(g), notes: g.notes, preferences: g.preferences, createdAt: g.createdAt.toISOString(), stays: stays.map(reservation_mapper_1.toReservationView) };
        });
    }
    async create(dto, access) {
        return this.prisma.forTenant(async (tx) => {
            await this.ensureEmailFree(tx, dto.email);
            const g = await tx.guest.create({
                data: {
                    organizationId: access.organizationId,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    email: (0, text_1.emptyToNull)(dto.email) ?? null,
                    phone: (0, text_1.emptyToNull)(dto.phone) ?? null,
                    country: (0, text_1.emptyToNull)(dto.country)?.toUpperCase() ?? null,
                    preferences: (0, text_1.emptyToNull)(dto.preferences) ?? null,
                    notes: (0, text_1.emptyToNull)(dto.notes) ?? null,
                    isVip: dto.isVip,
                },
                include,
            });
            await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.created', entity: 'guest', entityId: g.id, after: { name: `${g.firstName} ${g.lastName}` } });
            return toView(g);
        });
    }
    async update(id, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const existing = await tx.guest.findFirst({ where: { id, deletedAt: null }, include });
            if (!existing)
                throw (0, errors_1.notFound)('Guest');
            if (dto.email !== undefined && ((0, text_1.emptyToNull)(dto.email) ?? null)?.toLowerCase() !== existing.email?.toLowerCase()) {
                await this.ensureEmailFree(tx, dto.email, id);
            }
            const data = {};
            if (dto.firstName !== undefined)
                data.firstName = dto.firstName;
            if (dto.lastName !== undefined)
                data.lastName = dto.lastName;
            if (dto.email !== undefined)
                data.email = (0, text_1.emptyToNull)(dto.email);
            if (dto.phone !== undefined)
                data.phone = (0, text_1.emptyToNull)(dto.phone);
            if (dto.country !== undefined)
                data.country = (0, text_1.emptyToNull)(dto.country)?.toUpperCase() ?? null;
            if (dto.preferences !== undefined)
                data.preferences = (0, text_1.emptyToNull)(dto.preferences);
            if (dto.notes !== undefined)
                data.notes = (0, text_1.emptyToNull)(dto.notes);
            if (dto.isVip !== undefined)
                data.isVip = dto.isVip;
            const g = await tx.guest.update({ where: { id }, data, include });
            const diff = (0, changed_fields_1.changedFields)(existing, g, AUDITED);
            if (diff.changed.length > 0) {
                await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, action: 'guest.updated', entity: 'guest', entityId: id, before: diff.before, after: diff.after });
            }
            return toView(g);
        });
    }
    async ensureEmailFree(tx, email, exceptId) {
        const value = (0, text_1.emptyToNull)(email);
        if (!value)
            return;
        const clash = await tx.guest.findFirst({
            where: { email: { equals: value, mode: 'insensitive' }, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
            select: { id: true },
        });
        if (clash)
            throw (0, errors_1.conflict)('GUEST_EMAIL_EXISTS', 'A guest with this email already exists. Search for them instead of adding a duplicate.');
    }
};
exports.GuestsService = GuestsService;
exports.GuestsService = GuestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GuestsService);
//# sourceMappingURL=guests.service.js.map