// ================================================================== API keys
export const API_KEY_SCOPES = ['availability:read', 'bookings:create', 'bookings:read'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_KEY_SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'availability:read': 'See availability and prices',
  'bookings:create': 'Create bookings',
  'bookings:read': 'Look up a booking (needs the guest email)',
};

export const API_KEY_PREFIX = 'pmsk_live_';

// ================================================================== webhooks
export const WEBHOOK_EVENTS = ['reservation.created', 'reservation.status_changed', 'payment.received'] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];
/** Subscribe to every event, including ones added later. */
export const WEBHOOK_ALL_EVENTS = '*';

export const MAX_DELIVERY_ATTEMPTS = 7;
/** Seconds to wait after the 1st, 2nd, ... failed attempt before trying again. */
const RETRY_SECONDS = [30, 120, 600, 3600, 21_600, 86_400] as const;

/** After `attemptsMade` failed attempts: seconds until the next try, or null when it is time to give up. */
export function retryDelaySeconds(attemptsMade: number): number | null {
  if (attemptsMade >= MAX_DELIVERY_ATTEMPTS) return null;
  return RETRY_SECONDS[Math.max(attemptsMade, 1) - 1] ?? null;
}

export const eventMatches = (subscribed: readonly string[], type: string): boolean => subscribed.includes(WEBHOOK_ALL_EVENTS) || subscribed.includes(type);

/** Stop hammering an endpoint that keeps failing: this many deliveries in a row given up on turns it off. */
export const AUTO_DISABLE_AFTER_FAILURES = 10;

export interface WebhookEnvelope<T = unknown> {
  id: string;
  type: string;
  createdAt: string;
  propertyId: string | null;
  data: T;
}

// ================================================================== views
export interface ApiKeyView {
  id: string;
  name: string;
  /** The first characters only, enough to recognise a key. The full key is shown once, when it is created. */
  prefix: string;
  propertyIds: string[];
  scopes: ApiKeyScope[];
  autoConfirm: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKeyView {
  /** Shown ONCE. We keep only a one-way hash and can never show it again. */
  key: string;
}

export interface WebhookEndpointView {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  propertyId: string | null;
  isActive: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  createdAt: string;
}

export interface WebhookEndpointCreated extends WebhookEndpointView {
  /** Shown ONCE. Use it to check the X-PMS-Signature header on each delivery. */
  secret: string;
}

export interface WebhookDeliveryView {
  id: string;
  eventType: string;
  status: 'PENDING' | 'SUCCESS' | 'DEAD';
  attempts: number;
  nextAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

// ================================================================== public booking API (what a website receives)
export interface PublicPropertyView {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface PublicRoomOffer {
  roomTypeId: string;
  name: string;
  maxOccupancy: number;
  /** How many rooms of this type are free for the whole stay. */
  available: number;
  nights: number;
  totalMinor: number;
  currency: string;
  nightlyRatesMinor: number[];
}

export interface PublicAvailabilityView {
  propertyId: string;
  arrival: string;
  departure: string;
  offers: PublicRoomOffer[];
}

export interface PublicBookingView {
  code: string;
  status: string;
  propertyId: string;
  roomTypeName: string;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  totalMinor: number;
  currency: string;
}
