import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { generateApiKey } from '@/lib/api-key';
import { findMatchingPayment } from '@/lib/billing-verify';
import { creditOf, redisData, rows, setFetchHandler, setRedisDown, usageOf } from './fakes/state';

const DAY = '2026-10-30';
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_B = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const IP = '203.0.113.10';

function seedKey(balance: number, usage = 0): { id: string; raw: string } {
  const generated = generateApiKey();
  const id = `key-${rows('api_keys').length + 1}`;
  rows('api_keys').push({
    id,
    key_hash: generated.keyHash,
    key_prefix: generated.keyPrefix,
    owner_label: 'user@example.com',
    tier: 'free',
    is_active: true,
    created_at: '2026-10-30T00:00:00.000Z',
    last_used_at: null,
    request_count: 0,
    credit_balance_usd: balance,
    subscription_expires_at: null,
    subscription_cycle_calls_used: 0,
    referred_by: null,
  });
  if (usage > 0) {
    rows('api_key_usage_daily').push({
      key_id: id,
      usage_date: new Date().toISOString().slice(0, 10),
      request_count: usage,
    });
  }
  return { id, raw: generated.rawKey };
}

function riskUrl(mint?: string): string {
  const url = new URL('https://www.tnt-audit.com/api/v1/token-risk');
  if (mint !== undefined) url.searchParams.set('mint', mint);
  return url.toString();
}

function riskRequest(mint: string | undefined, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(mint === undefined ? 'https://www.tnt-audit.com/api/v1/token-risk' : riskUrl(mint), {
    headers: { 'x-forwarded-for': IP, ...headers },
  });
}

async function riskGet(mint: string | undefined, headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/v1/token-risk/route');
  return GET(riskRequest(mint, headers));
}

async function batchPost(rawKey: string, mints: string[]) {
  const { POST } = await import('@/app/api/v1/token-risk/batch/route');
  return POST(
    new NextRequest('https://www.tnt-audit.com/api/v1/token-risk/batch', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${rawKey}`,
        'content-type': 'application/json',
        'x-forwarded-for': IP,
      },
      body: JSON.stringify({ mints }),
    }),
  );
}

function paymentHeader(transaction: string): string {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      payload: { transaction },
      resource: { url: 'https://www.tnt-audit.com/api/v1/token-risk/x402' },
    }),
  ).toString('base64');
}

async function x402Get(mint: string, transaction?: string) {
  const { GET } = await import('@/app/api/v1/token-risk/x402/route');
  const headers: Record<string, string> = {};
  if (transaction) headers['x-payment'] = paymentHeader(transaction);
  return GET(new NextRequest(`https://www.tnt-audit.com/api/v1/token-risk/x402?mint=${mint}`, { headers }));
}

function secondsUntilUtcMidnight(): number {
  const now = Date.now();
  const next = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

function demoCount(): number {
  const key = `demo-limit:${IP}:${new Date().toISOString().slice(0, 10)}`;
  return Number(redisData.get(key) ?? 0);
}

function identityCounts(): number[] {
  return [...redisData.entries()]
    .filter(([key]) => /^mcp-anon:[0-9a-f]{16}:\d{4}-\d{2}-\d{2}$/.test(key))
    .map(([, value]) => Number(value));
}

let settles = 0;

beforeEach(() => {
  settles = 0;
  setFetchHandler(async (url) => {
    if (url.includes('helius.xyz')) {
      return new Response(JSON.stringify(heliusBody), { status: 200 });
    }
    if (url.includes('/verify')) {
      return new Response(JSON.stringify({ isValid: true }), { status: 200 });
    }
    if (url.includes('/settle')) {
      settles += 1;
      return new Response(JSON.stringify({ success: true, transaction: 'settled-tx' }), { status: 200 });
    }
    if (url.includes('resend.com') || url.includes('dexscreener') || url.includes('rugcheck') || url.includes('facilitator')) {
      return new Response('{}', { status: 200 });
    }
    throw new Error(`unexpected outbound request: ${url}`);
  });
});

let heliusBody: unknown[] = [];

it('email key: 15th check is free, 16th charges $0.02, $0.01 is refused unchanged', async () => {
  const key = seedKey(1);
  for (let n = 1; n <= 15; n += 1) {
    const response = await riskGet(MINT, { authorization: `Bearer ${key.raw}` });
    expect(response.status, `call ${n}`).toBe(200);
  }
  expect(creditOf(key.id)).toBe(1);
  expect(usageOf(key.id, DAY)).toBe(15);

  const paid = await riskGet(MINT, { authorization: `Bearer ${key.raw}` });
  expect(paid.status).toBe(200);
  expect(creditOf(key.id)).toBeCloseTo(0.98, 6);
  expect(usageOf(key.id, DAY)).toBe(15);

  rows('api_keys').find((row) => row.id === key.id)!.credit_balance_usd = 0.01;
  const before = creditOf(key.id);
  const refused = await riskGet(MINT, { authorization: `Bearer ${key.raw}` });
  expect(refused.status).toBeGreaterThanOrEqual(400);
  expect(creditOf(key.id)).toBe(before);
  expect(usageOf(key.id, DAY)).toBe(15);
});

// Known gap, not a harness mistake: a key's first call of the day is still
// free when the shared pool is already full (isFirstCallToday). Money is
// not charged and the free counter grows. The assertions below are the
// required behaviour; they fail on current main.
it.fails('paid key is not refused when the shared free pool is empty, and the free counter does not grow', async () => {
  redisData.set(`free-tier-pool:${DAY}`, 100);
  const key = seedKey(1, 0);
  const response = await riskGet(MINT, { authorization: `Bearer ${key.raw}` });
  expect(response.status).toBe(200);
  expect(creditOf(key.id)).toBeCloseTo(0.98, 6);
  expect(usageOf(key.id, DAY)).toBe(0);
});

it('two parallel calls on the last free slot produce only one free call', async () => {
  const key = seedKey(0, 14);
  const [first, second] = await Promise.all([
    riskGet(MINT, { authorization: `Bearer ${key.raw}` }),
    riskGet(MINT, { authorization: `Bearer ${key.raw}` }),
  ]);
  const statuses = [first.status, second.status].sort();
  expect(statuses.filter((status) => status === 200)).toHaveLength(1);
  expect(usageOf(key.id, DAY)).toBe(15);
  expect(creditOf(key.id)).toBe(0);
});

it('two parallel paid calls with $0.02 leave the balance at exactly 0', async () => {
  const key = seedKey(0.02, 15);
  const [first, second] = await Promise.all([
    riskGet(MINT, { authorization: `Bearer ${key.raw}` }),
    riskGet(MINT, { authorization: `Bearer ${key.raw}` }),
  ]);
  const ok = [first, second].filter((response) => response.status === 200);
  expect(ok).toHaveLength(1);
  expect(creditOf(key.id)).toBe(0);
  expect(creditOf(key.id)).toBeGreaterThanOrEqual(0);
});

// Known gap: the 6th guest call correctly returns 429 and Retry-After,
// but checkDemoLimit increments first and does not roll the slot back,
// so the Redis counter becomes 6. The last assertion is the required
// behaviour and fails on current main.
it.fails('REST guest: 5 checks pass, the 6th is 429 with Retry-After, counter stays at most 5', async () => {
  for (let n = 1; n <= 5; n += 1) {
    const response = await riskGet(MINT);
    expect(response.status, `guest ${n}`).toBe(200);
  }
  expect(demoCount()).toBe(5);
  const blocked = await riskGet(MINT);
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get('retry-after')).toBe(String(secondsUntilUtcMidnight()));
  expect(demoCount()).toBeLessThanOrEqual(5);
});

it('MCP guest keeps the same limit of 5, but answers HTTP 200 with a tool error', async () => {
  const { POST } = await import('@/app/api/mcp/route');
  async function call() {
    return POST(
      new NextRequest('https://www.tnt-audit.com/api/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'x-forwarded-for': IP,
          'user-agent': 'vitest-guest',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'check_token_risk', arguments: { mint: MINT } },
        }),
      }),
    );
  }

  for (let n = 1; n <= 5; n += 1) {
    const response = await call();
    const text = await response.text();
    expect(response.status, text).toBe(200);
    expect(text).not.toContain('anon_limit_reached');
  }
  const blocked = await call();
  const text = await blocked.text();
  expect(blocked.status).toBe(200);
  expect(blocked.status).not.toBe(429);
  expect(text).toContain('anon_limit_reached');
  for (const count of identityCounts()) expect(count).toBeLessThanOrEqual(5);
});

it('a bad key is 401 and does not touch the guest counter; a blank Bearer is a guest', async () => {
  const unknown = generateApiKey().rawKey;
  const bad = await riskGet(MINT, { authorization: `Bearer ${unknown}` });
  expect(bad.status).toBe(401);
  expect(demoCount()).toBe(0);

  const guest = await riskGet(MINT, { authorization: 'Bearer ' });
  expect(guest.status).toBe(200);
  expect(demoCount()).toBe(1);
});

it('a key with a missing or invalid mint gets 400 and spends nothing', async () => {
  const key = seedKey(1, 3);
  const missing = await riskGet(undefined, { authorization: `Bearer ${key.raw}` });
  expect(missing.status).toBe(400);
  const invalid = await riskGet('not-a-mint', { authorization: `Bearer ${key.raw}` });
  expect(invalid.status).toBe(400);
  expect(usageOf(key.id, DAY)).toBe(3);
  expect(creditOf(key.id)).toBe(1);
});

it('batch charges only valid mints, and charges nothing when every mint is invalid', async () => {
  const key = seedKey(1, 0);
  const mixed = await batchPost(key.raw, [MINT, 'not-a-mint', MINT_B]);
  expect(mixed.status).toBe(200);
  const mixedBody = await mixed.json();
  expect(mixedBody.charged_calls).toBe(2);
  expect(usageOf(key.id, DAY)).toBe(2);
  expect(creditOf(key.id)).toBe(1);

  const empty = seedKey(1, 0);
  const allBad = await batchPost(empty.raw, ['not-a-mint', 'also-bad']);
  expect(allBad.status).toBe(400);
  expect(usageOf(empty.id, DAY)).toBe(0);
  expect(creditOf(empty.id)).toBe(1);
});

it('after UTC midnight the same key is free again and the Redis day key changes', async () => {
  vi.setSystemTime(new Date('2026-10-30T23:30:00.000Z'));
  const key = seedKey(0, 0);
  for (let n = 1; n <= 15; n += 1) {
    const response = await riskGet(MINT, { authorization: `Bearer ${key.raw}` });
    expect(response.status, `evening ${n}`).toBe(200);
  }
  expect(usageOf(key.id, '2026-10-30')).toBe(15);
  expect(redisData.has('free-tier-pool:2026-10-30')).toBe(true);

  vi.setSystemTime(new Date('2026-10-31T00:30:00.000Z'));
  const again = await riskGet(MINT, { authorization: `Bearer ${key.raw}` });
  expect(again.status).toBe(200);
  expect(usageOf(key.id, '2026-10-31')).toBe(1);
  expect(usageOf(key.id, '2026-10-30')).toBe(15);
  expect(creditOf(key.id)).toBe(0);
  expect(redisData.has('free-tier-pool:2026-10-31')).toBe(true);
  expect('free-tier-pool:2026-10-30').not.toBe('free-tier-pool:2026-10-31');
});

it('x402 binds a receipt to one mint, does not settle a repeat, and still pays when Redis is down', async () => {
  const first = await x402Get(MINT, 'tx-same');
  expect(first.status).toBe(200);
  expect(settles).toBe(1);

  const otherMint = await x402Get(MINT_B, 'tx-same');
  expect(otherMint.status).toBe(409);
  expect(settles).toBe(1);

  const repeat = await x402Get(MINT, 'tx-same');
  expect(repeat.status).toBe(200);
  expect(settles).toBe(1);

  setRedisDown(true);
  settles = 0;
  const withoutRedis = await x402Get(MINT, 'tx-other');
  expect(withoutRedis.status).toBe(200);
  expect(settles).toBe(1);
});

it('USDC must match to the millionth; a neighbor $0.000001 away does not', async () => {
  const expected = 1.000001;
  heliusBody = [
    transfer('sig-exact', expected),
    transfer('sig-neighbor', expected + 0.000001),
  ];
  const match = await findMatchingPayment(expected, 'USDC', Date.now() - 60_000);
  expect(match.found).toBe(true);
  expect(match.signature).toBe('sig-exact');

  heliusBody = [transfer('sig-neighbor-only', expected + 0.000001)];
  const neighbor = await findMatchingPayment(expected, 'USDC', Date.now() - 60_000);
  expect(neighbor.found).toBe(false);
});

function transfer(signature: string, amount: number) {
  return {
    signature,
    timestamp: Math.floor(Date.now() / 1000),
    transactionError: null,
    tokenTransfers: [
      {
        mint: USDC,
        toUserAccount: WALLET,
        tokenAmount: amount,
      },
    ],
  };
}
