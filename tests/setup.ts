import { beforeEach, vi } from 'vitest';
import { currentFetchHandler, resetFakes } from './fakes/state';

process.env.KV_REST_API_URL = 'https://fake-redis.local';
process.env.KV_REST_API_TOKEN = 'fake-token';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role';
process.env.HELIUS_API_KEY = 'fake-helius';
process.env.X402_FEE_PAYER = '9p5hBDTrFRzyW4VhKMaq96XCtWkRPA9ZaSTnsM9qvtEE';
delete process.env.DEMO_PUBLIC_KEY;

vi.mock('@vercel/functions', () => ({
  waitUntil: (task: Promise<unknown> | unknown) => {
    void Promise.resolve(task).catch(() => {});
  },
}));

vi.mock('@upstash/redis', async () => {
  const { FakeRedis } = await import('./fakes/redis');
  return { Redis: FakeRedis };
});

vi.mock('@supabase/supabase-js', async () => {
  const { createFakeClient } = await import('./fakes/supabase');
  return {
    createClient: () => createFakeClient(),
  };
});

vi.mock('@/lib/token-risk-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/token-risk-core')>();
  return {
    ...actual,
    fetchTokenRisk: async (mint: string) => {
      if (!actual.isValidSolanaMint(mint)) {
        return { ok: false, mint, status: 400, error: `Invalid mint address: ${mint}` };
      }
      return {
        ok: true,
        mint,
        safety_score: 80,
        cluster_analysis: 'complete',
      };
    },
  };
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const custom = currentFetchHandler();
  if (custom) return custom(String(input), init);
  const url = String(input);
  if (url.includes('helius.xyz')) return json([]);
  if (url.includes('/verify')) return json({ isValid: true });
  if (url.includes('/settle')) return json({ success: true, transaction: 'settled-tx' });
  if (url.includes('resend.com')) return json({ id: 'email_fake' });
  if (url.includes('dexscreener') || url.includes('rugcheck') || url.includes('facilitator')) return json({});
  throw new Error(`unexpected outbound request: ${url}`);
});

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-30T12:00:00.000Z'));

beforeEach(() => {
  resetFakes();
  vi.setSystemTime(new Date('2026-10-30T12:00:00.000Z'));
});
