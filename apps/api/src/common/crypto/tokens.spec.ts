import { describe, expect, it } from 'vitest';
import { decryptString, deriveDevKey, encryptString, generateApiKey, generateWebhookSecret, hashApiKey, looksLikeApiKey, signWebhook, verifyWebhook } from './tokens';

describe('API keys', () => {
  it('has a recognisable prefix, is long and random, and only its hash is derived from it', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key.startsWith('pmsk_live_')).toBe(true);
    expect(a.key.length).toBeGreaterThanOrEqual(50);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).toHaveLength(64);
    expect(a.hash).not.toContain(a.key.slice(10, 20));
    expect(a.key.startsWith(a.prefix)).toBe(true);
    expect(a.prefix.length).toBeLessThan(20); // the shown prefix is only a small part of the key
  });

  it('the same key always gives the same hash and different keys differ', () => {
    expect(hashApiKey('x')).toBe(hashApiKey('x'));
    expect(hashApiKey('x')).not.toBe(hashApiKey('y'));
  });

  it('rejects things that cannot be a key before touching the database', () => {
    expect(looksLikeApiKey(generateApiKey().key)).toBe(true);
    for (const v of ['', 'abc', 'pmsk_live_short', 'Bearer pmsk_live_x', `pmsk_live_${'a'.repeat(500)}`]) expect(looksLikeApiKey(v), v).toBe(false);
  });
});

describe('webhook signatures', () => {
  const secret = 'whsec_test_secret';
  const body = JSON.stringify({ id: 'evt_1', type: 'reservation.created' });

  it('is deterministic and depends on the secret, the time and every byte of the body', () => {
    const s = signWebhook(secret, 1_700_000_000, body);
    expect(s).toBe(signWebhook(secret, 1_700_000_000, body));
    expect(s.startsWith('sha256=')).toBe(true);
    expect(s).not.toBe(signWebhook('other', 1_700_000_000, body));
    expect(s).not.toBe(signWebhook(secret, 1_700_000_001, body));
    expect(s).not.toBe(signWebhook(secret, 1_700_000_000, `${body} `));
  });

  it('is verified by the receiver, and a tampered body, wrong secret or old timestamp is refused', () => {
    const now = 1_700_000_100;
    const s = signWebhook(secret, 1_700_000_000, body);
    expect(verifyWebhook(secret, 1_700_000_000, body, s, now)).toBe(true);
    expect(verifyWebhook(secret, 1_700_000_000, body.replace('created', 'deleted'), s, now)).toBe(false);
    expect(verifyWebhook('wrong', 1_700_000_000, body, s, now)).toBe(false);
    expect(verifyWebhook(secret, 1_700_000_000, body, s, now + 10_000)).toBe(false); // replayed much later
    expect(verifyWebhook(secret, 1_700_000_000, body, 'sha256=bad', now)).toBe(false);
    expect(verifyWebhook(secret, 1_700_000_000, body, '', now)).toBe(false);
  });

  it('generates a different secret each time', () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
    expect(generateWebhookSecret().startsWith('whsec_')).toBe(true);
  });
});

describe('encrypting stored secrets', () => {
  const key = deriveDevKey('a-development-secret-value');

  it('round-trips, and the stored text does not contain the secret', () => {
    const stored = encryptString(key, 'whsec_super_secret');
    expect(stored.startsWith('v1:')).toBe(true);
    expect(stored).not.toContain('super_secret');
    expect(decryptString(key, stored)).toBe('whsec_super_secret');
  });

  it('encrypting the same text twice gives different results (a fresh random IV each time)', () => {
    expect(encryptString(key, 'same')).not.toBe(encryptString(key, 'same'));
  });

  it('fails loudly if the stored value was changed or the key is wrong', () => {
    const stored = encryptString(key, 'secret');
    const parts = stored.split(':');
    const tampered = [parts[0], parts[1], parts[2], `${parts[3]!.slice(0, -2)}AA`].join(':');
    expect(() => decryptString(key, tampered)).toThrow();
    expect(() => decryptString(deriveDevKey('another-secret'), stored)).toThrow();
    expect(() => decryptString(key, 'garbage')).toThrow();
  });
});
