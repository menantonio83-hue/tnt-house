// Version 1.0 — lib/webhook-ssrf-guard.ts
//
// Basic SSRF guard for user-supplied callback_url values (webhook
// subscriptions). Checked once, at subscribe time — not re-checked on
// every delivery, since QStash performs the actual outbound request
// for a triggered webhook (see lib/qstash-publish.ts), not this repo.
//
// Two layers:
// 1. Must be https, must not be an obviously-local hostname string.
// 2. Resolve the hostname's DNS records and reject if ANY resolved IP
//    falls in a private/loopback/link-local range — a bare string
//    check on the hostname alone (e.g. blocking "localhost") misses a
//    hostname an attacker controls that simply resolves to 127.0.0.1
//    or an internal IP.
//
// NOT a complete defense against DNS-rebinding (pointing DNS somewhere
// safe at subscribe time, then re-pointing it at a private IP before
// delivery) — closing that fully would mean re-resolving on every
// single delivery, which we don't control anyway since QStash makes
// the actual request. Good enough for the MVP threat model; revisit if
// this API scales past that.

import dns from 'dns';

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

const PRIVATE_V4_RANGES: Array<[number, number]> = [
  [ipToInt('10.0.0.0'), ipToInt('10.255.255.255')],
  [ipToInt('172.16.0.0'), ipToInt('172.31.255.255')],
  [ipToInt('192.168.0.0'), ipToInt('192.168.255.255')],
  [ipToInt('127.0.0.0'), ipToInt('127.255.255.255')],
  [ipToInt('169.254.0.0'), ipToInt('169.254.255.255')],
  [ipToInt('0.0.0.0'), ipToInt('0.255.255.255')],
];

function isPrivateV4(ip: string): boolean {
  const n = ipToInt(ip);
  return PRIVATE_V4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

export interface SsrfCheckResult {
  safe: boolean;
  reason?: string;
}

export async function isCallbackUrlSafe(rawUrl: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'not a valid URL' };
  }

  if (url.protocol !== 'https:') {
    return { safe: false, reason: 'must be https' };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    return { safe: false, reason: 'local hostname not allowed' };
  }

  try {
    const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    for (const record of records) {
      if (record.family === 4 && isPrivateV4(record.address)) {
        return { safe: false, reason: `resolves to a private IP (${record.address})` };
      }
      if (record.family === 6 && isPrivateV6(record.address)) {
        return { safe: false, reason: `resolves to a private IPv6 address (${record.address})` };
      }
    }
  } catch (e: any) {
    return { safe: false, reason: `DNS resolution failed: ${e.message}` };
  }

  return { safe: true };
}
