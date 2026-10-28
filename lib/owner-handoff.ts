// Version 1.0 — lib/owner-handoff.ts
//
// v1.0: owner handoff flow. When a keyed quota/credit refusal reaches an AI agent, the refusal carries owner_message + owner_pay_url. For paid-tier keys or any failure, no handoff is created and the original refusal is returned unchanged. The link carries only a random token; the raw API key never appears in URLs, pages, logs or responses.

import { randomBytes } from 'crypto';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { ApiKeyRecord } from '@/lib/api-key-store';
import { createInvoiceForKey } from '@/lib/billing-actions';
import { getPaymentById, type PaymentRecord } from '@/lib/billing-store';
import {
  MIN_TOPUP_USD,
  PENDING_INVOICE_TTL_MINUTES,
  WALLET_ADDRESS,
  USDC_CA,
  MRDT_CA,
  formatPayAmount,
} from '@/lib/billing-pricing';
import { SITE_ORIGIN } from '@/lib/refusal-options';

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const HANDOFF_TTL_SECONDS = PENDING_INVOICE_TTL_MINUTES * 60;
const MAX_HANDOFF_CREATES_PER_KEY_PER_HOUR = 3;
const MAX_HANDOFF_CREATES_GLOBAL_PER_HOUR = 200;
const VERIFY_POLL_MIN_INTERVAL_SECONDS = 5;
// The token record outlives the invoice by an hour so an owner who paid near
// the deadline still sees the final paid/expired state instead of a 404.
const TOKEN_RECORD_TTL_SECONDS = HANDOFF_TTL_SECONDS + 3600;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export const AGENT_ACCESS_URL = `${SITE_ORIGIN}/agent-access`;

export const ANON_OWNER_MESSAGE = `Your AI agent has used its free anonymous RiskDataApi calls for today. To let it continue, give it a free API key (15 calls/day) or an x402-capable wallet — step-by-step instructions: ${AGENT_ACCESS_URL}`;

export const HANDOFF_ERROR_CODES = new Set([
  'free_daily_limit_reached',
  'paid_balance_exceeded',
  'free_pool_capacity',
]);

export interface OwnerHandoff {
  owner_message: string;
  owner_pay_url: string;
}

export interface HandoffRecord {
  payment_id: string;
  key_id: string;
}

function payUrl(token: string): string {
  return `${SITE_ORIGIN}/owner-pay/${token}`;
}

function ownerMessage(url: string): string {
  return `Your AI agent ran out of RiskDataApi calls. To let it continue, pay $${MIN_TOPUP_USD} in USDC on Solana here: ${url} — the page shows the exact amount, wallet address and a QR code, and tells you when your agent can continue. The link expires in ${PENDING_INVOICE_TTL_MINUTES} minutes.`;
}

async function readRecord(token: string): Promise<HandoffRecord | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(`handoff:tok:${token}`);
    if (!raw) return null;
    const rec = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (
      rec &&
      typeof rec === 'object' &&
      typeof (rec as HandoffRecord).payment_id === 'string' &&
      typeof (rec as HandoffRecord).key_id === 'string'
    ) {
      return {
        payment_id: (rec as HandoffRecord).payment_id,
        key_id: (rec as HandoffRecord).key_id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getOrCreateOwnerHandoff(key: ApiKeyRecord): Promise<OwnerHandoff | null> {
  try {
    if (!redis || !key || key.tier === 'paid') return null;
    const client = redis;

    const existing = await client.get<string>(`handoff:key:${key.id}`);
    if (typeof existing === 'string' && TOKEN_RE.test(existing)) {
      const rec = await readRecord(existing);
      if (rec && rec.key_id === key.id) {
        const p = await getPaymentById(rec.payment_id);
        if (
          p &&
          p.status === 'pending' &&
          p.key_id === key.id &&
          Date.now() - new Date(p.created_at).getTime() < HANDOFF_TTL_SECONDS * 1000 - 60_000
        ) {
          return {
            owner_pay_url: payUrl(existing),
            owner_message: ownerMessage(payUrl(existing)),
          };
        }
      }
    }

    const hour = Math.floor(Date.now() / 3_600_000);
    const perKey = await client.incr(`handoff:rl:key:${key.id}:${hour}`);
    if (perKey === 1) await client.expire(`handoff:rl:key:${key.id}:${hour}`, 7200);
    if (perKey > MAX_HANDOFF_CREATES_PER_KEY_PER_HOUR) return null;

    const global = await client.incr(`handoff:rl:global:${hour}`);
    if (global === 1) await client.expire(`handoff:rl:global:${hour}`, 7200);
    if (global > MAX_HANDOFF_CREATES_GLOBAL_PER_HOUR) return null;

    const result = await createInvoiceForKey(key, {
      kind: 'topup',
      currency: 'USDC',
      usd_amount: MIN_TOPUP_USD,
    });

    if (result.status !== 200 || typeof result.body.payment_id !== 'string') return null;

    const token = randomBytes(24).toString('base64url');
    await client.set(
      `handoff:tok:${token}`,
      JSON.stringify({ payment_id: result.body.payment_id, key_id: key.id }),
      { ex: TOKEN_RECORD_TTL_SECONDS },
    );
    await client.set(`handoff:key:${key.id}`, token, { ex: HANDOFF_TTL_SECONDS });

    return {
      owner_pay_url: payUrl(token),
      owner_message: ownerMessage(payUrl(token)),
    };
  } catch (error: any) {
    console.error('[owner-handoff] create failed:', (error as any)?.message);
    return null;
  }
}

export async function attachOwnerHandoff<T extends Record<string, any>>(
  body: T | null,
  key: ApiKeyRecord | null,
): Promise<T | null> {
  if (body && key && HANDOFF_ERROR_CODES.has(body.error_code)) {
    const h = await getOrCreateOwnerHandoff(key);
    if (h) return { ...body, ...h };
  }
  return body;
}

export async function withOwnerHandoff(
  response: NextResponse,
  key: ApiKeyRecord | null,
): Promise<NextResponse> {
  try {
    const body = await response.clone().json();
    const next = await attachOwnerHandoff(body, key);
    if (next === body || !next) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return NextResponse.json(next, { status: response.status, headers });
  } catch {
    return response;
  }
}

export function attachAnonOwnerInfo<T extends Record<string, any>>(body: T): T & OwnerHandoff {
  return {
    ...body,
    owner_message: ANON_OWNER_MESSAGE,
    owner_pay_url: AGENT_ACCESS_URL,
  };
}

export async function resolveHandoffToken(token: unknown): Promise<HandoffRecord | null> {
  if (!redis || typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  try {
    return await readRecord(token);
  } catch {
    return null;
  }
}

export async function claimVerifySlot(paymentId: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const r = await redis.set(`handoff:poll:${paymentId}`, '1', {
      nx: true,
      ex: VERIFY_POLL_MIN_INTERVAL_SECONDS,
    });
    return r === 'OK';
  } catch {
    return false;
  }
}

export function tokenMintFor(currency: string): string | null {
  switch (currency) {
    case 'USDC':
      return USDC_CA;
    case 'MRDT':
      return MRDT_CA;
    case 'SOL':
      return null;
    default:
      return null;
  }
}

export function buildSolanaPayUrl(p: PaymentRecord): string {
  const mint = tokenMintFor(p.currency);
  return (
    `solana:${WALLET_ADDRESS}?amount=${formatPayAmount(p.pay_amount, p.currency)}` +
    (mint ? `&spl-token=${mint}` : '') +
    `&label=${encodeURIComponent('TNT House RiskDataApi')}&message=${encodeURIComponent('RiskDataApi call credit top-up')}`
  );
}

export interface HandoffView {
  status: 'pending' | 'confirmed' | 'expired';
  kind: string;
  currency: string;
  usd_amount: number;
  pay_amount_formatted: string;
  wallet_address: string;
  token_mint: string | null;
  solana_pay_url: string;
  expires_at: string;
  verified: boolean;
  message: string;
}

export function toHandoffView(p: PaymentRecord): HandoffView {
  const expiresAtMs = new Date(p.created_at).getTime() + HANDOFF_TTL_SECONDS * 1000;
  const expires_at = new Date(expiresAtMs).toISOString();
  const now = Date.now();

  let status: HandoffView['status'] = p.status;
  if (p.status === 'pending' && now > expiresAtMs) {
    status = 'expired';
  }

  let message: string;
  if (status === 'confirmed') {
    message = 'Paid — your agent can continue.';
  } else if (status === 'expired') {
    message = 'This payment link has expired. Ask your agent to retry; it will get a fresh link.';
  } else {
    message = `Send exactly ${formatPayAmount(p.pay_amount, p.currency)} ${p.currency} in one transaction to the address below.`;
  }

  return {
    status,
    kind: p.kind,
    currency: p.currency,
    usd_amount: p.usd_amount,
    pay_amount_formatted: formatPayAmount(p.pay_amount, p.currency),
    wallet_address: WALLET_ADDRESS,
    token_mint: tokenMintFor(p.currency),
    solana_pay_url: buildSolanaPayUrl(p),
    expires_at,
    verified: p.status === 'confirmed',
    message,
  };
}
