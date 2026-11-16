import {
  AUTO_DISABLE_AFTER_FAILURES, MAX_DELIVERY_ATTEMPTS, WEBHOOK_ALL_EVENTS, WEBHOOK_EVENTS, API_KEY_SCOPES, eventMatches, retryDelaySeconds,
} from '@pms/types';
import { WebhookDeliveryStatus as PrismaDeliveryStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildResendRequest } from '../mail/resend-request';

describe('webhook retries', () => {
  it('waits longer after each failure, starting at 30 seconds', () => {
    const waits = [1, 2, 3, 4, 5, 6].map((n) => retryDelaySeconds(n));
    expect(waits).toEqual([30, 120, 600, 3600, 21_600, 86_400]);
    for (let i = 1; i < waits.length; i++) expect(waits[i]! > waits[i - 1]!).toBe(true);
  });

  it('gives up after the last allowed attempt, and never retries forever', () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(7);
    expect(retryDelaySeconds(MAX_DELIVERY_ATTEMPTS)).toBeNull();
    expect(retryDelaySeconds(MAX_DELIVERY_ATTEMPTS + 5)).toBeNull();
  });

  it('always has a finite wait before the last attempt, and the whole schedule is about a day and a half', () => {
    let total = 0;
    for (let n = 1; n < MAX_DELIVERY_ATTEMPTS; n++) {
      const w = retryDelaySeconds(n);
      expect(w).not.toBeNull();
      total += w as number;
    }
    expect(total < 3 * 86_400).toBe(true);
  });

  it('turns an endpoint off after ten deliveries in a row were given up on', () => {
    expect(AUTO_DISABLE_AFTER_FAILURES).toBe(10);
  });
});

describe('which endpoints get an event', () => {
  it('matches a subscribed event, or everything with *', () => {
    expect(eventMatches(['reservation.created'], 'reservation.created')).toBe(true);
    expect(eventMatches(['reservation.created'], 'payment.received')).toBe(false);
    expect(eventMatches([WEBHOOK_ALL_EVENTS], 'payment.received')).toBe(true);
    expect(eventMatches([WEBHOOK_ALL_EVENTS], 'anything.added.later')).toBe(true);
    expect(eventMatches([], 'reservation.created')).toBe(false);
  });

  it('knows exactly three events today', () => {
    expect([...WEBHOOK_EVENTS].sort()).toEqual(['payment.received', 'reservation.created', 'reservation.status_changed']);
  });
});

describe('API key scopes', () => {
  it('only allow reading availability, creating bookings and looking up a booking', () => {
    expect([...API_KEY_SCOPES].sort()).toEqual(['availability:read', 'bookings:create', 'bookings:read']);
  });
});

describe('database enums', () => {
  it('delivery statuses match the Prisma enum', () => {
    expect(Object.values(PrismaDeliveryStatus).sort()).toEqual(['DEAD', 'PENDING', 'SUCCESS']);
  });
});

describe('email through resend.com', () => {
  const req = buildResendRequest('re_secret', 'Hotel PMS <noreply@example.com>', { to: 'guest@example.com', subject: 'Welcome', text: 'Hello' });

  it('sends the message to the right place with the key in the Authorization header only', () => {
    expect(req.url).toBe('https://api.resend.com/emails');
    expect(req.init.method).toBe('POST');
    expect(req.init.headers.Authorization).toBe('Bearer re_secret');
    expect(req.init.body).not.toContain('re_secret');
  });

  it('puts the recipient, sender, subject and text in the body', () => {
    expect(JSON.parse(req.init.body)).toEqual({ from: 'Hotel PMS <noreply@example.com>', to: ['guest@example.com'], subject: 'Welcome', text: 'Hello' });
  });

  it('keeps awkward characters intact (quotes, line breaks, accents)', () => {
    const r = buildResendRequest('k', 'a@b.co', { to: 'x@y.co', subject: 'Señor "Cruz"', text: 'line1\nline2' });
    expect(JSON.parse(r.init.body).subject).toBe('Señor "Cruz"');
    expect(JSON.parse(r.init.body).text).toBe('line1\nline2');
  });
});
