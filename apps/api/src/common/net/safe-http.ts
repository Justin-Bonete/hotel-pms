import dns from 'node:dns';
import type { LookupAddress, LookupOptions } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

// ================================================================== which addresses are off limits
function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIPv4(ip: string): boolean {
  const p = parseIPv4(ip);
  if (!p) return true; // anything we cannot read is refused
  const [a, b, c] = p as [number, number, number, number];
  return (
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, including cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // documentation
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // documentation
    (a === 203 && b === 0 && c === 113) || // documentation
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Expands an IPv6 address into its eight 16-bit groups, or null if it is not valid. */
function parseIPv6(ip: string): number[] | null {
  let text = ip.split('%')[0] ?? ip; // drop a zone id (fe80::1%eth0)
  if (!net.isIPv6(text)) return null;
  const tail = text.lastIndexOf(':');
  if (text.slice(tail + 1).includes('.')) {
    const v4 = parseIPv4(text.slice(tail + 1));
    if (!v4) return null;
    text = `${text.slice(0, tail + 1)}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`;
  }
  const [head, rest] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = rest !== undefined && rest !== '' ? rest.split(':') : [];
  const missing = 8 - left.length - right.length;
  if (text.includes('::') ? missing < 0 : left.length !== 8) return null;
  const groups = text.includes('::') ? [...left, ...Array(missing).fill('0'), ...right] : left;
  const nums = groups.map((g) => parseInt(g, 16));
  return nums.length === 8 && nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? nums : null;
}

function isBlockedIPv6(ip: string): boolean {
  const g = parseIPv6(ip);
  if (!g) return true;
  const embeddedV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedIPv4(embeddedV4(g[6]!, g[7]!)); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedIPv4(embeddedV4(g[6]!, g[7]!)); // NAT64
  if (g[0] === 0x2002) return isBlockedIPv4(embeddedV4(g[1]!, g[2]!)); // 6to4
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

/** true = this address is on a private or otherwise internal network and must never be contacted. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip.split('%')[0] ?? ip)) return isBlockedIPv6(ip);
  return true;
}

// ================================================================== which addresses a person may enter
export interface UrlOptions {
  /** Development only: allow http:// and addresses on this computer or network (so you can test with a local server). */
  allowPrivateNetworks: boolean;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** The checks that can be made without the network. The connection itself is checked again when it is made (safePost). */
export function validateWebhookUrl(raw: string, options: UrlOptions): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'That is not a valid web address.' };
  }
  if (url.protocol !== 'https:' && !(options.allowPrivateNetworks && url.protocol === 'http:')) return { ok: false, reason: 'The address must start with https://' };
  if (url.username || url.password) return { ok: false, reason: 'The address must not contain a username or password.' };
  if (options.allowPrivateNetworks) return { ok: true, url };

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !net.isIP(host)) {
    return { ok: false, reason: 'That address points at a private or internal name. Use your public address.' };
  }
  if (net.isIP(host) && isBlockedAddress(host)) return { ok: false, reason: 'That address is on a private network. Use your public address.' };
  return { ok: true, url };
}

// ================================================================== sending
export interface SafePostResult {
  status: number;
}

/**
 * POST without ever touching an internal network. The destination is checked when the connection is MADE (not just
 * when the address was saved), so a name that later starts pointing at a private address is refused. Redirects are not
 * followed. The response body is discarded.
 */
export function safePost(rawUrl: string, args: { headers: Record<string, string>; body: string; timeoutMs: number; allowPrivateNetworks: boolean }): Promise<SafePostResult> {
  return new Promise((resolve, reject) => {
    const check = validateWebhookUrl(rawUrl, { allowPrivateNetworks: args.allowPrivateNetworks });
    if (!check.ok) return reject(new Error(check.reason));
    const url = check.url;
    const transport = url.protocol === 'https:' ? https : http;

    const lookup = (hostname: string, options: LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, '', 0);
        const allowed = args.allowPrivateNetworks ? addresses : addresses.filter((a) => !isBlockedAddress(a.address));
        if (allowed.length === 0) return callback(Object.assign(new Error('That address resolves to a private network and was blocked.'), { code: 'EBLOCKED' }), '', 0);
        if (options.all) return callback(null, allowed);
        callback(null, allowed[0]!.address, allowed[0]!.family);
      });
    };

    const req = transport.request(
      url,
      { method: 'POST', headers: { ...args.headers, 'Content-Length': String(Buffer.byteLength(args.body)) }, lookup: lookup as never, timeout: args.timeoutMs },
      (res) => {
        res.resume(); // read and throw away the body
        res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error(`No answer within ${Math.round(args.timeoutMs / 1000)} seconds`)));
    req.on('error', reject);
    req.end(args.body);
  });
}
