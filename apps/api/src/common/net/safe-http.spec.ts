import { describe, expect, it } from 'vitest';
import { isBlockedAddress, validateWebhookUrl } from './safe-http';

describe('addresses that must never be contacted', () => {
  it('blocks private, loopback, link-local (cloud metadata) and reserved IPv4 ranges', () => {
    for (const ip of ['127.0.0.1', '127.255.255.254', '10.0.0.5', '10.255.255.255', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '100.127.255.255', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.2.10']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows ordinary public IPv4 addresses, including the edges of the private ranges', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '11.0.0.1', '9.255.255.255', '193.168.1.1', '203.0.114.1']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it('blocks IPv6 loopback, unspecified, unique-local, link-local and multicast', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456:789a::1', 'fe80::1', 'febf::1', 'ff02::1', '2001:db8::1', '0:0:0:0:0:0:0:1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('blocks private IPv4 addresses hidden inside IPv6 (mapped, NAT64, 6to4)', () => {
    for (const ip of ['::ffff:127.0.0.1', '::ffff:10.1.2.3', '::ffff:169.254.169.254', '::ffff:7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::1', '2002:a9fe:a9fe::1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6 and public IPv4 hidden in IPv6', () => {
    for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it('refuses anything that is not an IP address at all (fails closed)', () => {
    for (const ip of ['', 'not-an-ip', '999.1.1.1', '1.2.3', '1.2.3.4.5', 'gggg::1']) expect(isBlockedAddress(ip), ip).toBe(true);
  });
});

describe('webhook addresses people may enter', () => {
  const strict = { allowPrivateNetworks: false };

  it('accepts a normal https address', () => {
    expect(validateWebhookUrl('https://hooks.example.com/pms?token=abc', strict).ok).toBe(true);
    expect(validateWebhookUrl('https://8.8.8.8/hook', strict).ok).toBe(true);
  });

  it('refuses plain http, other schemes and addresses with a password in them', () => {
    expect(validateWebhookUrl('http://hooks.example.com', strict).ok).toBe(false);
    expect(validateWebhookUrl('ftp://hooks.example.com', strict).ok).toBe(false);
    expect(validateWebhookUrl('file:///etc/passwd', strict).ok).toBe(false);
    expect(validateWebhookUrl('https://user:pass@hooks.example.com', strict).ok).toBe(false);
    expect(validateWebhookUrl('not a url', strict).ok).toBe(false);
  });

  it('refuses internal names and private IP addresses, including cloud metadata', () => {
    for (const u of ['https://localhost/hook', 'https://app.localhost/x', 'https://printer.local/x', 'https://db.internal/x', 'https://intranet/x', 'https://127.0.0.1/x', 'https://10.0.0.1/x', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/x', 'https://[::ffff:10.0.0.1]/x', 'https://192.168.0.10:8443/x']) {
      expect(validateWebhookUrl(u, strict).ok, u).toBe(false);
    }
  });

  it('in development mode a local test server is allowed, over http too (never in production)', () => {
    const dev = { allowPrivateNetworks: true };
    expect(validateWebhookUrl('http://localhost:9000/hook', dev).ok).toBe(true);
    expect(validateWebhookUrl('http://127.0.0.1:9000/hook', dev).ok).toBe(true);
    expect(validateWebhookUrl('ftp://localhost/hook', dev).ok).toBe(false);
    expect(validateWebhookUrl('https://user:pass@localhost/hook', dev).ok).toBe(false);
  });
});
