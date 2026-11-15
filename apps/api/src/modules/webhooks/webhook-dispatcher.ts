import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AUTO_DISABLE_AFTER_FAILURES, retryDelaySeconds } from '@pms/types';
import { CryptoService } from '../../common/crypto/crypto.service';
import { signWebhook } from '../../common/crypto/tokens';
import { safePost } from '../../common/net/safe-http';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface Due {
  id: string;
  organization_id: string;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  attempts: number;
  payload: unknown;
}

const BATCH = 20;
const LEASE_SECONDS = 90;
const TIMEOUT_MS = 10_000;

/**
 * The webhook worker. Every few seconds it claims deliveries that are due, sends them, and records what happened.
 * "SKIP LOCKED" plus a lease means several API servers can run it side by side without sending anything twice.
 * Delivery is AT LEAST ONCE: a receiver must tolerate seeing the same event id again.
 */
@Injectable()
export class WebhookDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Webhooks');
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    if (this.env.WEBHOOK_DISPATCH_INTERVAL_MS <= 0) {
      this.logger.log('Webhook worker is off (WEBHOOK_DISPATCH_INTERVAL_MS=0).');
      return;
    }
    const timer = setInterval(() => void this.tick(), this.env.WEBHOOK_DISPATCH_INTERVAL_MS);
    (timer as unknown as { unref?: () => void }).unref?.(); // never keep the process alive just for this timer
    this.timer = timer;
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass: send what is due (a few batches at most, so one pass never runs for long). */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 5; i++) {
        const batch = await this.claim();
        if (batch.length === 0) break;
        await Promise.all(batch.map((d) => this.deliver(d).catch((err: Error) => this.logger.error(`Delivery ${d.id} crashed: ${err.message}`))));
        if (batch.length < BATCH) break;
      }
    } catch (err) {
      this.logger.warn(`Webhook pass failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private claim(): Promise<Due[]> {
    return this.prisma.withoutTenant('webhook worker: claim due deliveries across organizations', (tx) =>
      tx.$queryRaw<Due[]>`
        UPDATE webhook_deliveries SET locked_until = now() + (${LEASE_SECONDS} * interval '1 second')
        WHERE id IN (
          SELECT id FROM webhook_deliveries
          WHERE status = 'PENDING' AND next_attempt_at <= now() AND (locked_until IS NULL OR locked_until < now())
          ORDER BY next_attempt_at LIMIT ${BATCH} FOR UPDATE SKIP LOCKED
        )
        RETURNING id, organization_id, endpoint_id, event_id, event_type, attempts, payload`,
    );
  }

  private async deliver(d: Due): Promise<void> {
    const endpoint = await this.prisma.forOrganization(d.organization_id, (tx) => tx.webhookEndpoint.findFirst({ where: { id: d.endpoint_id } }));
    if (!endpoint || endpoint.deletedAt || !endpoint.isActive) {
      return this.finish(d, { ok: false, give_up: true, error: 'The endpoint was turned off or removed.', statusCode: null });
    }

    const body = JSON.stringify(d.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const secret = this.crypto.decrypt(endpoint.secretEnc);
      const res = await safePost(endpoint.url, {
        body,
        timeoutMs: TIMEOUT_MS,
        allowPrivateNetworks: this.env.NODE_ENV !== 'production',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HotelPMS-Webhooks/1',
          'X-PMS-Event': d.event_type,
          'X-PMS-Delivery': d.id,
          'X-PMS-Event-Id': d.event_id,
          'X-PMS-Timestamp': String(timestamp),
          'X-PMS-Signature': signWebhook(secret, timestamp, body),
        },
      });
      statusCode = res.status;
      if (res.status < 200 || res.status >= 300) error = `The receiver answered ${res.status}`;
    } catch (err) {
      error = (err as Error).message.slice(0, 300);
    }
    await this.finish(d, { ok: error === null, give_up: false, error, statusCode });
  }

  private async finish(d: Due, r: { ok: boolean; give_up: boolean; error: string | null; statusCode: number | null }): Promise<void> {
    const attempts = d.attempts + 1;
    await this.prisma.forOrganization(d.organization_id, async (tx) => {
      if (r.ok) {
        await tx.webhookDelivery.updateMany({ where: { id: d.id, status: 'PENDING' }, data: { status: 'SUCCESS', attempts, deliveredAt: new Date(), lastStatusCode: r.statusCode, lastError: null, lockedUntil: null } });
        await tx.webhookEndpoint.updateMany({ where: { id: d.endpoint_id, consecutiveFailures: { gt: 0 } }, data: { consecutiveFailures: 0 } });
        return;
      }
      const delay = r.give_up ? null : retryDelaySeconds(attempts);
      if (delay !== null) {
        await tx.webhookDelivery.updateMany({ where: { id: d.id, status: 'PENDING' }, data: { attempts, lastStatusCode: r.statusCode, lastError: r.error, nextAttemptAt: new Date(Date.now() + delay * 1000), lockedUntil: null } });
        return;
      }
      await tx.webhookDelivery.updateMany({ where: { id: d.id, status: 'PENDING' }, data: { status: 'DEAD', attempts, lastStatusCode: r.statusCode, lastError: r.error, lockedUntil: null } });
      if (r.give_up) return;
      // Given up on this delivery. If it keeps happening, stop sending to a dead address.
      const endpoint = await tx.webhookEndpoint.update({ where: { id: d.endpoint_id }, data: { consecutiveFailures: { increment: 1 } } });
      if (endpoint.isActive && endpoint.consecutiveFailures >= AUTO_DISABLE_AFTER_FAILURES) {
        await tx.webhookEndpoint.update({ where: { id: d.endpoint_id }, data: { isActive: false, disabledReason: `Turned off automatically after ${AUTO_DISABLE_AFTER_FAILURES} deliveries in a row failed.` } });
        await this.audit.record(tx, { organizationId: d.organization_id, actorId: null, propertyId: endpoint.propertyId ?? undefined, action: 'webhook.auto_disabled', entity: 'webhook_endpoint', entityId: d.endpoint_id, after: { url: endpoint.url } });
      }
    });
  }
}
