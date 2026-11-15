import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { eventMatches, type WebhookDeliveryView, type WebhookEndpointCreated, type WebhookEndpointView, type WebhookEnvelope } from '@pms/types';
import type { CreateWebhookInput, UpdateWebhookInput } from '@pms/validation';
import type { AccessContext } from '../../common/access/access-context';
import { assertCan } from '../../common/access/assert-access';
import { CryptoService } from '../../common/crypto/crypto.service';
import { generateWebhookSecret } from '../../common/crypto/tokens';
import { AppException } from '../../common/http/app-exception';
import { badRequest, conflict, notFound } from '../../common/http/errors';
import { validateWebhookUrl } from '../../common/net/safe-http';
import { emptyToNull } from '../../common/text/text';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { PrismaService, Tx } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type EndpointRow = Prisma.WebhookEndpointGetPayload<object>;

const toView = (e: EndpointRow): WebhookEndpointView => ({
  id: e.id, url: e.url, description: e.description, events: e.events, propertyId: e.propertyId, isActive: e.isActive,
  consecutiveFailures: e.consecutiveFailures, disabledReason: e.disabledReason, createdAt: e.createdAt.toISOString(),
});

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ================================================================ publishing events (called from other modules)
  /**
   * Queue an event for every subscribed endpoint, INSIDE the caller's transaction: it is saved together with the change
   * that caused it, so it can never be lost, and never sent for something that rolled back. A worker delivers it.
   */
  async enqueue(tx: Tx, input: { organizationId: string; propertyId: string | null; type: string; data: unknown }): Promise<void> {
    const endpoints = await tx.webhookEndpoint.findMany({
      where: { isActive: true, deletedAt: null, OR: input.propertyId ? [{ propertyId: null }, { propertyId: input.propertyId }] : [{ propertyId: null }] },
      select: { id: true, events: true },
    });
    const matching = endpoints.filter((e) => eventMatches(e.events, input.type));
    if (matching.length === 0) return;
    const eventId = randomUUID();
    const payload: WebhookEnvelope = { id: eventId, type: input.type, createdAt: new Date().toISOString(), propertyId: input.propertyId, data: input.data };
    await tx.webhookDelivery.createMany({
      data: matching.map((e) => ({ organizationId: input.organizationId, endpointId: e.id, eventId, eventType: input.type, propertyId: input.propertyId, payload: payload as unknown as Prisma.InputJsonValue })),
    });
  }

  // ================================================================ endpoints
  async list(access: AccessContext): Promise<WebhookEndpointView[]> {
    const scope = access.scopeOf('integration.read');
    if (!scope.all && scope.ids.size === 0) return [];
    const rows = await this.prisma.forTenant((tx) => tx.webhookEndpoint.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }));
    return rows.filter((e) => this.canSee(access, e.propertyId)).map(toView);
  }

  async create(dto: CreateWebhookInput, access: AccessContext): Promise<WebhookEndpointCreated> {
    this.assertManage(access, dto.propertyId ?? null);
    this.assertUrl(dto.url);
    const secret = generateWebhookSecret();
    return this.prisma.forTenant(async (tx) => {
      if (dto.propertyId && !(await tx.property.findFirst({ where: { id: dto.propertyId, deletedAt: null }, select: { id: true } }))) throw badRequest('INVALID_PROPERTY', 'That property does not exist.');
      const row = await tx.webhookEndpoint.create({
        data: { organizationId: access.organizationId, propertyId: dto.propertyId ?? null, url: dto.url, description: emptyToNull(dto.description) ?? null, secretEnc: this.crypto.encrypt(secret), events: dto.events, createdById: access.userId },
      });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: dto.propertyId, action: 'webhook.created', entity: 'webhook_endpoint', entityId: row.id, after: { url: row.url, events: row.events } });
      return { ...toView(row), secret };
    });
  }

  async update(id: string, dto: UpdateWebhookInput, access: AccessContext): Promise<WebhookEndpointView> {
    return this.prisma.forTenant(async (tx) => {
      const existing = await this.load(tx, id);
      this.assertManage(access, existing.propertyId);
      if (dto.url !== undefined) this.assertUrl(dto.url);
      const data: Prisma.WebhookEndpointUncheckedUpdateInput = {};
      if (dto.url !== undefined) data.url = dto.url;
      if (dto.description !== undefined) data.description = emptyToNull(dto.description);
      if (dto.events !== undefined) data.events = dto.events;
      if (dto.isActive !== undefined) {
        data.isActive = dto.isActive;
        if (dto.isActive) { data.consecutiveFailures = 0; data.disabledReason = null; } else { data.disabledReason = 'Turned off by a person'; }
      }
      const row = await tx.webhookEndpoint.update({ where: { id }, data });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId ?? undefined, action: 'webhook.updated', entity: 'webhook_endpoint', entityId: id, before: { url: existing.url, events: existing.events, isActive: existing.isActive }, after: { url: row.url, events: row.events, isActive: row.isActive } });
      return toView(row);
    });
  }

  /** Removed from the list and stops receiving events; past deliveries stay for the record. */
  async remove(id: string, access: AccessContext): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      const existing = await this.load(tx, id);
      this.assertManage(access, existing.propertyId);
      await tx.webhookEndpoint.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId ?? undefined, action: 'webhook.deleted', entity: 'webhook_endpoint', entityId: id, before: { url: existing.url } });
    });
  }

  /** A new signing secret, shown once. The old one stops working immediately. */
  async rotateSecret(id: string, access: AccessContext): Promise<WebhookEndpointCreated> {
    const secret = generateWebhookSecret();
    return this.prisma.forTenant(async (tx) => {
      const existing = await this.load(tx, id);
      this.assertManage(access, existing.propertyId);
      const row = await tx.webhookEndpoint.update({ where: { id }, data: { secretEnc: this.crypto.encrypt(secret) } });
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: existing.propertyId ?? undefined, action: 'webhook.secret_rotated', entity: 'webhook_endpoint', entityId: id });
      return { ...toView(row), secret };
    });
  }

  /** Sends a harmless test event to this one endpoint so the person can see it arrive. */
  async sendTest(id: string, access: AccessContext): Promise<WebhookDeliveryView> {
    return this.prisma.forTenant(async (tx) => {
      const endpoint = await this.load(tx, id);
      this.assertManage(access, endpoint.propertyId);
      if (!endpoint.isActive) throw conflict('ENDPOINT_OFF', 'This endpoint is turned off. Turn it on first.');
      const eventId = randomUUID();
      const payload: WebhookEnvelope = { id: eventId, type: 'webhook.test', createdAt: new Date().toISOString(), propertyId: endpoint.propertyId, data: { message: 'This is a test delivery from Hotel PMS.' } };
      const row = await tx.webhookDelivery.create({ data: { organizationId: access.organizationId, endpointId: id, eventId, eventType: 'webhook.test', propertyId: endpoint.propertyId, payload: payload as unknown as Prisma.InputJsonValue } });
      return this.deliveryView(row);
    });
  }

  async deliveries(id: string, access: AccessContext): Promise<WebhookDeliveryView[]> {
    return this.prisma.forTenant(async (tx) => {
      const endpoint = await this.load(tx, id, true);
      if (!this.canSee(access, endpoint.propertyId)) throw notFound('Webhook'); // not visible to this person: don't reveal it exists
      const rows = await tx.webhookDelivery.findMany({ where: { endpointId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
      return rows.map((r) => this.deliveryView(r));
    });
  }

  /** Try a delivery that was given up on once more, from the start. */
  async redeliver(deliveryId: string, access: AccessContext): Promise<WebhookDeliveryView> {
    return this.prisma.forTenant(async (tx) => {
      const delivery = await tx.webhookDelivery.findFirst({ where: { id: deliveryId }, include: { endpoint: true } });
      if (!delivery || delivery.endpoint.deletedAt) throw notFound('Delivery');
      this.assertManage(access, delivery.endpoint.propertyId);
      if (!delivery.endpoint.isActive) throw conflict('ENDPOINT_OFF', 'This endpoint is turned off. Turn it on first.');
      const claimed = await tx.webhookDelivery.updateMany({ where: { id: deliveryId, status: 'DEAD' }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lockedUntil: null, lastError: null } });
      if (claimed.count === 0) throw conflict('NOT_FAILED', 'Only a delivery that failed for good can be sent again.');
      await this.audit.record(tx, { organizationId: access.organizationId, actorId: access.userId, propertyId: delivery.endpoint.propertyId ?? undefined, action: 'webhook.redelivered', entity: 'webhook_delivery', entityId: deliveryId, after: { event: delivery.eventType } });
      return this.deliveryView(await tx.webhookDelivery.findFirstOrThrow({ where: { id: deliveryId } }));
    });
  }

  // ================================================================ internals
  private deliveryView(r: Prisma.WebhookDeliveryGetPayload<object>): WebhookDeliveryView {
    return {
      id: r.id, eventType: r.eventType, status: r.status, attempts: r.attempts, nextAttemptAt: r.status === 'PENDING' ? r.nextAttemptAt.toISOString() : null,
      lastStatusCode: r.lastStatusCode, lastError: r.lastError, createdAt: r.createdAt.toISOString(), deliveredAt: r.deliveredAt?.toISOString() ?? null,
    };
  }

  private async load(tx: Tx, id: string, includeDeleted = false): Promise<EndpointRow> {
    const row = await tx.webhookEndpoint.findFirst({ where: { id, ...(includeDeleted ? {} : { deletedAt: null }) } });
    if (!row) throw notFound('Webhook');
    return row;
  }

  private canSee(access: AccessContext, propertyId: string | null): boolean {
    const scope = access.scopeOf('integration.read');
    return scope.all || (propertyId !== null && scope.ids.has(propertyId));
  }

  /** An endpoint for ALL properties needs organization-wide access; one for a single property needs access to that property. */
  private assertManage(access: AccessContext, propertyId: string | null): void {
    if (propertyId === null) {
      if (!access.scopeOf('integration.manage').all) throw new AppException('FORBIDDEN', 'Only someone with access to every property can manage a webhook for all properties. Choose one property instead.', HttpStatus.FORBIDDEN);
      return;
    }
    assertCan(access, 'integration.manage', propertyId);
  }

  private assertUrl(url: string): void {
    const check = validateWebhookUrl(url, { allowPrivateNetworks: this.env.NODE_ENV !== 'production' });
    if (!check.ok) throw badRequest('INVALID_URL', check.reason);
  }
}
