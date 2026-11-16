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
exports.FoliosService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const types_1 = require("@pms/types");
const assert_access_1 = require("../../common/access/assert-access");
const app_exception_1 = require("../../common/http/app-exception");
const errors_1 = require("../../common/http/errors");
const text_1 = require("../../common/text/text");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const webhooks_service_1 = require("../webhooks/webhooks.service");
const realtime_service_1 = require("../realtime/realtime.service");
const folio_display_1 = require("./folio-display");
const folio_ledger_service_1 = require("./folio-ledger.service");
const reservationSelect = {
    id: true, code: true, organizationId: true, propertyId: true, status: true, currency: true,
    guest: { select: { firstName: true, lastName: true } },
    property: { select: { name: true } },
};
const money = (minor, currency) => (0, types_1.formatMoney)(minor, currency);
let FoliosService = class FoliosService {
    prisma;
    ledger;
    audit;
    realtime;
    webhooks;
    constructor(prisma, ledger, audit, realtime, webhooks) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.audit = audit;
        this.realtime = realtime;
        this.webhooks = webhooks;
    }
    // ================================================================ read
    async get(reservationId, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await this.loadReservation(tx, reservationId);
            (0, assert_access_1.assertCan)(access, 'folio.read', r.propertyId);
            return this.view(tx, r);
        });
    }
    // ================================================================ extra charge
    async addCharge(reservationId, dto, key, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await this.loadReservation(tx, reservationId);
            (0, assert_access_1.assertCan)(access, 'folio.charge', r.propertyId);
            if (await this.alreadyDone(tx, 'folioItem', key))
                return this.view(tx, r);
            if (r.status !== 'CHECKED_IN')
                throw (0, errors_1.conflict)('NOT_IN_HOUSE', 'Charges can only be posted while the guest is checked in.');
            const folio = await this.ledger.ensureFolio(tx, r);
            this.assertOpen(folio.status);
            const amount = dto.quantity * dto.unitAmountMinor;
            const id = (0, node_crypto_1.randomUUID)();
            const rows = [
                { id, organizationId: r.organizationId, folioId: folio.id, type: 'EXTRA_CHARGE', description: dto.description, quantity: dto.quantity, unitAmountMinor: dto.unitAmountMinor, amountMinor: amount, source: 'FRONT_DESK', idempotencyKey: key ?? null, createdById: access.userId },
            ];
            if (dto.taxable) {
                const taxes = await tx.tax.findMany({ where: { propertyId: r.propertyId, isActive: true, deletedAt: null, appliesToExtras: true }, orderBy: { name: 'asc' } });
                for (const tax of taxes) {
                    const t = (0, types_1.calcTaxMinor)(amount, tax.rateBps);
                    if (t > 0)
                        rows.push({ id: (0, node_crypto_1.randomUUID)(), organizationId: r.organizationId, folioId: folio.id, type: 'TAX', description: `${tax.name} (${(0, types_1.formatRate)(tax.rateBps)})`, quantity: 1, unitAmountMinor: t, amountMinor: t, parentItemId: id, taxId: tax.id, source: 'SYSTEM', createdById: access.userId });
                }
            }
            await tx.folioItem.createMany({ data: rows });
            await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'folio.charge_posted', entity: 'folio', entityId: folio.id, after: { reservation: r.code, description: dto.description, amount: money(amount, r.currency) } });
            return this.view(tx, r, true);
        });
    }
    // ================================================================ discount / adjustment
    async addAdjustment(reservationId, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await this.loadReservation(tx, reservationId);
            (0, assert_access_1.assertCan)(access, 'folio.adjust', r.propertyId);
            if (r.status !== 'CHECKED_IN')
                throw (0, errors_1.conflict)('NOT_IN_HOUSE', 'Adjustments can only be posted while the guest is checked in.');
            const folio = await this.ledger.ensureFolio(tx, r);
            this.assertOpen(folio.status);
            await tx.folioItem.create({
                data: { organizationId: r.organizationId, folioId: folio.id, type: dto.amountMinor < 0 ? 'DISCOUNT' : 'ADJUSTMENT', description: dto.description, quantity: 1, unitAmountMinor: dto.amountMinor, amountMinor: dto.amountMinor, reason: dto.reason, source: 'FRONT_DESK', createdById: access.userId },
                select: { id: true },
            });
            await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: dto.amountMinor < 0 ? 'folio.discount_posted' : 'folio.adjustment_posted', entity: 'folio', entityId: folio.id, after: { reservation: r.code, description: dto.description, amount: money(dto.amountMinor, r.currency), reason: dto.reason } });
            return this.view(tx, r, true);
        });
    }
    // ================================================================ void (reversal, never delete)
    async voidItem(itemId, dto, access) {
        return this.prisma.forTenant(async (tx) => {
            const item = await tx.folioItem.findFirst({ where: { id: itemId }, include: { folio: true, taxLines: true, reversedBy: { select: { id: true } } } });
            if (!item)
                throw (0, errors_1.notFound)('Folio line');
            const r = await this.loadReservation(tx, item.folio.reservationId);
            (0, assert_access_1.assertCan)(access, 'folio.adjust', r.propertyId);
            this.assertOpen(item.folio.status);
            if (!types_1.VOIDABLE_ITEM_TYPES.includes(item.type))
                throw (0, errors_1.badRequest)('NOT_VOIDABLE', 'Tax lines are voided together with the charge they belong to.');
            if (item.reversedBy)
                throw (0, errors_1.conflict)('ALREADY_VOIDED', 'This line has already been voided.');
            const lines = [item, ...item.taxLines];
            const reversalOfParent = (0, node_crypto_1.randomUUID)();
            const rows = lines.map((line) => ({
                id: line.id === item.id ? reversalOfParent : (0, node_crypto_1.randomUUID)(),
                organizationId: r.organizationId,
                folioId: line.folioId,
                type: 'REVERSAL',
                description: `VOID: ${line.description}`,
                serviceDate: line.serviceDate,
                quantity: 1,
                unitAmountMinor: -line.amountMinor,
                amountMinor: -line.amountMinor,
                parentItemId: line.id === item.id ? null : reversalOfParent,
                reversesItemId: line.id,
                reason: dto.reason,
                source: 'FRONT_DESK',
                createdById: access.userId,
            }));
            // Parent row first so the foreign key on parentItemId resolves.
            rows.sort((a, b) => (a.id === reversalOfParent ? -1 : b.id === reversalOfParent ? 1 : 0));
            await tx.folioItem.createMany({ data: rows });
            await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'folio.item_voided', entity: 'folio_item', entityId: itemId, before: { description: item.description, amount: money(item.amountMinor, r.currency) }, after: { reason: dto.reason, linesReversed: rows.length } });
            return this.view(tx, r, true);
        });
    }
    // ================================================================ payment / deposit
    async recordPayment(reservationId, dto, key, access) {
        return this.prisma.forTenant(async (tx) => {
            const r = await this.loadReservation(tx, reservationId);
            (0, assert_access_1.assertCan)(access, 'payment.take', r.propertyId);
            if (await this.alreadyDone(tx, 'payment', key))
                return this.view(tx, r);
            if (!types_1.PAYABLE_RESERVATION_STATUSES.includes(r.status)) {
                throw (0, errors_1.conflict)('NOT_PAYABLE', 'Payments can only be taken for pending, confirmed, in-house or checked-out reservations.');
            }
            const folio = await this.ledger.ensureFolio(tx, r);
            // After the room charges exist, never take more than is owed. (Before check-in a deposit is open-ended.)
            if (folio.roomChargesPostedAt) {
                const { balanceMinor } = await this.ledger.balance(tx, folio.id);
                if (dto.amountMinor > Math.max(balanceMinor, 0)) {
                    throw (0, errors_1.conflict)('OVERPAYMENT', `That is more than the balance due (${money(Math.max(balanceMinor, 0), r.currency)}).`);
                }
            }
            const payment = await tx.payment.create({
                data: { organizationId: r.organizationId, folioId: folio.id, amountMinor: dto.amountMinor, method: dto.method, reference: (0, text_1.emptyToNull)(dto.reference) ?? null, note: (0, text_1.emptyToNull)(dto.note) ?? null, idempotencyKey: key ?? null, receivedById: access.userId },
                select: { id: true },
            });
            await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'payment.received', entity: 'payment', entityId: payment.id, after: { reservation: r.code, amount: money(dto.amountMinor, r.currency), method: dto.method } });
            await this.webhooks.enqueue(tx, { organizationId: r.organizationId, propertyId: r.propertyId, type: 'payment.received', data: { paymentId: payment.id, reservationId: r.id, reservationCode: r.code, amountMinor: dto.amountMinor, currency: r.currency, method: dto.method } });
            return this.view(tx, r, true);
        });
    }
    // ================================================================ refund
    async refund(paymentId, dto, key, access) {
        return this.prisma.forTenant(async (tx) => {
            const payment = await tx.payment.findFirst({ where: { id: paymentId }, include: { folio: { select: { reservationId: true } } } });
            if (!payment)
                throw (0, errors_1.notFound)('Payment');
            const r = await this.loadReservation(tx, payment.folio.reservationId);
            (0, assert_access_1.assertCan)(access, 'payment.refund', r.propertyId);
            if (await this.alreadyDone(tx, 'refund', key))
                return this.view(tx, r);
            // Serialize refunds of the same payment so two clicks can't refund more than was paid.
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${'refund:' + paymentId}))`;
            const already = await tx.refund.aggregate({ where: { paymentId }, _sum: { amountMinor: true } });
            const refundable = payment.amountMinor - (already._sum.amountMinor ?? 0);
            if (dto.amountMinor > refundable) {
                throw new app_exception_1.AppException('REFUND_TOO_LARGE', `Only ${money(refundable, r.currency)} of this payment can still be refunded.`, common_1.HttpStatus.CONFLICT);
            }
            const refund = await tx.refund.create({
                data: { organizationId: r.organizationId, paymentId, amountMinor: dto.amountMinor, reason: dto.reason, idempotencyKey: key ?? null, createdById: access.userId },
                select: { id: true },
            });
            await this.audit.record(tx, { organizationId: r.organizationId, actorId: access.userId, propertyId: r.propertyId, action: 'payment.refunded', entity: 'refund', entityId: refund.id, before: { payment: money(payment.amountMinor, r.currency) }, after: { reservation: r.code, refunded: money(dto.amountMinor, r.currency), reason: dto.reason } });
            return this.view(tx, r, true);
        });
    }
    // ================================================================ internals
    async loadReservation(tx, id) {
        const r = await tx.reservation.findFirst({ where: { id }, select: reservationSelect });
        if (!r)
            throw (0, errors_1.notFound)('Reservation');
        return r;
    }
    assertOpen(status) {
        if (status !== 'OPEN')
            throw (0, errors_1.conflict)('FOLIO_CLOSED', 'This folio is closed. Only payments can still be recorded.');
    }
    /** Same Idempotency-Key twice = the first request already did the work. */
    async alreadyDone(tx, model, key) {
        if (!key)
            return false;
        const where = { idempotencyKey: key };
        const found = model === 'payment' ? await tx.payment.findFirst({ where, select: { id: true } }) : model === 'refund' ? await tx.refund.findFirst({ where, select: { id: true } }) : await tx.folioItem.findFirst({ where, select: { id: true } });
        return found !== null;
    }
    async view(tx, r, changed = false) {
        // Only a real change notifies other screens. A plain read must never emit, or screens would refetch forever.
        if (changed)
            this.realtime.emit(r.organizationId, 'folio.changed', r.propertyId, [r.id]);
        const folio = await tx.folio.findFirst({
            where: { reservationId: r.id },
            include: {
                items: { orderBy: [{ createdAt: 'asc' }, { serviceDate: 'asc' }], include: { reversedBy: { select: { id: true } } } },
                payments: { orderBy: { createdAt: 'asc' }, include: { refunds: { orderBy: { createdAt: 'asc' } } } },
            },
        });
        const base = { reservationId: r.id, reservationCode: r.code, guestName: `${r.guest.firstName} ${r.guest.lastName}`, propertyName: r.property.name, currency: r.currency };
        if (!folio)
            return { ...base, id: null, status: 'OPEN', roomChargesPosted: false, items: [], payments: [], totals: (0, types_1.computeFolioTotals)({ items: [], payments: [], refunds: [] }) };
        const refunds = folio.payments.flatMap((p) => p.refunds);
        const items = (0, folio_display_1.orderForDisplay)(folio.items);
        return {
            ...base,
            id: folio.id,
            status: folio.status,
            currency: folio.currency,
            roomChargesPosted: folio.roomChargesPostedAt !== null,
            items: items.map((i) => ({
                id: i.id,
                type: i.type,
                description: i.description,
                serviceDate: i.serviceDate ? (0, types_1.toDateString)(i.serviceDate) : null,
                quantity: i.quantity,
                unitAmountMinor: i.unitAmountMinor,
                amountMinor: i.amountMinor,
                parentItemId: i.parentItemId,
                reversesItemId: i.reversesItemId,
                voided: i.reversedBy !== null,
                voidable: folio.status === 'OPEN' && i.reversedBy === null && types_1.VOIDABLE_ITEM_TYPES.includes(i.type),
                reason: i.reason,
                createdAt: i.createdAt.toISOString(),
            })),
            payments: folio.payments.map((p) => ({
                id: p.id,
                amountMinor: p.amountMinor,
                refundedMinor: p.refunds.reduce((sum, x) => sum + x.amountMinor, 0),
                method: p.method,
                reference: p.reference,
                note: p.note,
                createdAt: p.createdAt.toISOString(),
                refunds: p.refunds.map((x) => ({ id: x.id, amountMinor: x.amountMinor, reason: x.reason, createdAt: x.createdAt.toISOString() })),
            })),
            totals: (0, types_1.computeFolioTotals)({ items, payments: folio.payments, refunds }),
        };
    }
};
exports.FoliosService = FoliosService;
exports.FoliosService = FoliosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        folio_ledger_service_1.FolioLedger,
        audit_service_1.AuditService,
        realtime_service_1.RealtimeService,
        webhooks_service_1.WebhooksService])
], FoliosService);
//# sourceMappingURL=folios.service.js.map