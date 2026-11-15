import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { API_KEY_PREFIX } from '@pms/types';

// ================================================================== API keys
/** A new random key. Only its hash is stored; `prefix` is the non-secret part shown in lists. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

/** SHA-256 is right here (not a slow password hash) because the key is 256 random bits, not a guessable password. */
export const hashApiKey = (key: string): string => createHash('sha256').update(key).digest('hex');

export const looksLikeApiKey = (value: string): boolean => value.startsWith(API_KEY_PREFIX) && value.length >= API_KEY_PREFIX.length + 40 && value.length <= 200;

// ================================================================== webhook signatures
export const generateWebhookSecret = (): string => `whsec_${randomBytes(32).toString('base64url')}`;

/**
 * What the receiver should check: HMAC-SHA256 over "<timestamp>.<raw body>" with the endpoint's secret, sent as
 * `X-PMS-Signature: sha256=<hex>`. Including the timestamp stops an old delivery from being replayed later.
 */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

/** The receiver-side check (also used in our tests and documentation): constant-time compare, with a time window. */
export function verifyWebhook(secret: string, timestamp: number, body: string, signature: string, nowSeconds: number, toleranceSeconds = 300): boolean {
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, timestamp, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ================================================================== encrypting stored secrets
/** Key for development when DATA_ENCRYPTION_KEY is not set. Never used in production (the setting is required there). */
export const deriveDevKey = (jwtSecret: string): Buffer => createHash('sha256').update(`pms-dev-data-key:${jwtSecret}`).digest();

/** AES-256-GCM. Output "v1:<iv>:<tag>:<ciphertext>" (base64url). Any change to it makes decryption fail loudly. */
export function encryptString(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

export function decryptString(key: Buffer, payload: string): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
