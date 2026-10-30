// Version 1.7 — lib/x402/verify.ts
//
// v1.7: replay protection on top of the v1.6 flow. A verified payment
// is claimed in Redis (SET NX) and tied to one mint. A settle timeout
// keeps the claim so a retry of the same payment can settle again
// instead of paying twice. The 402 challenge and the resource check
// are unchanged. Redis down: the old flow runs, with a warning.
//
// Version 1.6 — lib/x402/verify.ts
//
// x402 payment verification helper for RiskDataApi
// Talks to the public x402 facilitator to verify and settle Solana USDC payments
// Does NOT touch existing API-key billing logic — this is an additive payment channel
//
// v1.6: feePayer discovery, PayAI facilitator, hardening (from Claude prep)
// v1.3: fixed the SVM `extra` field — it was carrying EVM EIP-712 domain
// fields ({name: 'USDC', version: '2'}), which are meaningless on Solana
// and made the x402-list.com directory reject the listing.

import { createHash, randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';

const FACILITATOR_URL = (process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network').replace(/\/+$/, '');
const RECEIVING_WALLET = process.env.X402_WALLET_ADDRESS || '9p5hBDTrFRzyW4VhKMaq96XCtWkRPA9ZaSTnsM9qvtEE';
const NETWORK_CAIP2 = process.env.X402_NETWORK_CAIP2 || 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const FACILITATOR_FETCH_TIMEOUT_MS = 10_000;
const FEE_PAYER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedFeePayer: { value: string; fetchedAt: number } | null = null;
let feePayerInFlight: Promise<string> | null = null;

export interface ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { feePayer: string; memo?: string };
}

export interface PaymentRequiredBody {
  x402Version: 2;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirement[];
}

export interface VerifyResult {
  isValid: boolean;
  errorReason?: string;
}

export interface SettleResult {
  success: boolean;
  transactionHash?: string;
  errorReason?: string;
  timedOut?: boolean;
}

const USDC_MINT_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function facilitatorFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${FACILITATOR_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FACILITATOR_FETCH_TIMEOUT_MS),
  });
}

function isPlausibleSolanaAddress(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

async function fetchFeePayerFromFacilitator(): Promise<string> {
  const response = await facilitatorFetch('/supported');
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[x402] /supported failed', response.status, body.slice(0, 500));
    throw new Error(`facilitator_supported_${response.status}`);
  }

  const data = await response.json();
  const namespace = NETWORK_CAIP2.split(':')[0]; // "solana"

  // Shape A — top-level signers map (Coinbase style)
  let value: unknown = data?.signers?.[NETWORK_CAIP2] ?? data?.signers?.[`${namespace}:*`];
  if (Array.isArray(value)) value = value[0];

  // Shape B — per-kind extra.feePayer (PayAI style)
  if (!isPlausibleSolanaAddress(value) && Array.isArray(data?.kinds)) {
    const kind =
      data.kinds.find((k: any) => k?.network === NETWORK_CAIP2) ??
      data.kinds.find((k: any) => typeof k?.network === 'string' && k.network.startsWith(`${namespace}:`));
    value = kind?.extra?.feePayer;
  }

  if (!isPlausibleSolanaAddress(value)) {
    console.error('[x402] /supported has no usable Solana fee payer. Raw:', JSON.stringify(data).slice(0, 800));
    throw new Error('facilitator_no_valid_fee_payer');
  }

  return value;
}

async function getFeePayer(): Promise<string> {
  if (process.env.X402_FEE_PAYER) {
    return process.env.X402_FEE_PAYER;
  }

  const now = Date.now();
  if (cachedFeePayer && now - cachedFeePayer.fetchedAt < FEE_PAYER_CACHE_TTL_MS) {
    return cachedFeePayer.value;
  }

  if (!feePayerInFlight) {
    feePayerInFlight = fetchFeePayerFromFacilitator()
      .then((value) => {
        cachedFeePayer = { value, fetchedAt: Date.now() };
        return value;
      })
      .finally(() => {
        feePayerInFlight = null;
      });
  }

  try {
    return await feePayerInFlight;
  } catch (error) {
    if (cachedFeePayer) {
      console.warn('[x402] facilitator /supported failed, serving stale cached feePayer:', (error as Error).message);
      return cachedFeePayer.value;
    }
    throw error;
  }
}

export async function buildPaymentRequiredBody(
  resourcePath: string,
  priceUsdcAtomic: string,
  description: string,
  errorMessage?: string,
): Promise<PaymentRequiredBody> {
  if (!/^\d+$/.test(priceUsdcAtomic)) {
    throw new Error(`invalid priceUsdcAtomic (must be a plain non-negative integer string): ${priceUsdcAtomic}`);
  }
  const fullUrl = `https://www.tnt-audit.com${resourcePath}`;
  const feePayer = await getFeePayer();
  return {
    x402Version: 2,
    ...(errorMessage ? { error: errorMessage } : {}),
    resource: {
      url: fullUrl,
      description,
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK_CAIP2,
        amount: priceUsdcAtomic,
        asset: USDC_MINT_SOLANA,
        payTo: RECEIVING_WALLET,
        maxTimeoutSeconds: 60,
        extra: { feePayer },
      },
    ],
  };
}

const MAX_PAYMENT_HEADER_CHARS = 8 * 1024;

function decodePaymentHeader(paymentHeader: string): Record<string, unknown> {
  if (paymentHeader.length > MAX_PAYMENT_HEADER_CHARS) {
    throw new Error('payment header exceeds size limit');
  }
  const json = Buffer.from(paymentHeader, 'base64').toString('utf-8');
  const parsed = JSON.parse(json);
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('decoded payment payload is not an object');
  }
  return parsed as Record<string, unknown>;
}

export async function verifyPayment(
  paymentHeader: string,
  requirement: PaymentRequirement,
  expectedResourceUrl?: string,
): Promise<VerifyResult> {
  let paymentPayload: Record<string, unknown>;
  try {
    paymentPayload = decodePaymentHeader(paymentHeader);
  } catch {
    return { isValid: false, errorReason: 'invalid_payload' };
  }

  if (expectedResourceUrl) {
    const claimedUrl = (paymentPayload.resource as { url?: unknown } | undefined)?.url;
    if (typeof claimedUrl === 'string' && claimedUrl !== expectedResourceUrl) {
      return { isValid: false, errorReason: 'resource_mismatch' };
    }
  }

  try {
    const response = await facilitatorFetch('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[x402] /verify failed', response.status, body.slice(0, 1000));
      return { isValid: false, errorReason: `facilitator_error_${response.status}` };
    }

    const data = await response.json();
    return { isValid: data.isValid === true, errorReason: data.invalidReason };
  } catch (error) {
    console.error('[x402] /verify request error:', (error as Error).message);
    return { isValid: false, errorReason: 'facilitator_unreachable' };
  }
}

export async function settlePayment(
  paymentHeader: string,
  requirement: PaymentRequirement,
): Promise<SettleResult> {
  let paymentPayload: Record<string, unknown>;
  try {
    paymentPayload = decodePaymentHeader(paymentHeader);
  } catch {
    return { success: false, errorReason: 'invalid_payload' };
  }

  try {
    const response = await facilitatorFetch('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[x402] /settle failed', response.status, body.slice(0, 1000));
      const timedOut = response.status === 408 || response.status === 504;
      return { success: false, errorReason: `facilitator_error_${response.status}`, timedOut };
    }

    const data = await response.json();
    return {
      success: data.success === true,
      transactionHash: data.transaction ?? data.transactionHash ?? data.txHash,
      errorReason: data.errorReason,
    };
  } catch (error) {
    const err = error as Error;
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError' || /timeout|aborted/i.test(err.message);
    console.error('[x402] /settle request error:', err.message);
    return { success: false, errorReason: timedOut ? 'facilitator_timeout' : 'facilitator_unreachable', timedOut };
  }
}

// ---- v1.7 replay protection (best effort when Redis is down) ----

const receiptRedis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

const RECEIPT_HELD_TTL_SECONDS = 120;
const RECEIPT_DONE_TTL_SECONDS = 24 * 60 * 60;

// held: being processed now. settled: paid. settle_timeout: verified,
// settle did not answer in time — the next retry settles again.
export type X402ReceiptState = 'held' | 'settled' | 'settle_timeout';

export interface X402Receipt {
  state: X402ReceiptState;
  mint: string;
  token?: string;
  transactionHash?: string;
}

export type X402ReceiptLookup =
  | { kind: 'none' }
  | { kind: 'unavailable' }
  | { kind: 'found'; receipt: X402Receipt };

function receiptKey(receiptId: string): string {
  return `x402-receipt:${receiptId}`;
}

function parseReceipt(raw: unknown): X402Receipt | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const rec = value as X402Receipt;
  if (!['held', 'settled', 'settle_timeout'].includes(rec.state) || typeof rec.mint !== 'string') return null;
  return rec;
}

// Stable id for one payment: the signed transaction inside the header,
// so re-encoding the same header gives the same id.
export function x402ReceiptId(paymentHeader: string): string | null {
  try {
    const decoded = decodePaymentHeader(paymentHeader);
    const inner = decoded.payload;
    let material = paymentHeader;
    if (inner && typeof inner === 'object') {
      const tx = (inner as { transaction?: unknown }).transaction;
      const signature = (inner as { signature?: unknown }).signature;
      if (typeof tx === 'string' && tx.length > 0) material = tx;
      else if (typeof signature === 'string' && signature.length > 0) material = signature;
    }
    return createHash('sha256').update(material).digest('hex');
  } catch {
    return null;
  }
}

export async function lookupX402Receipt(receiptId: string): Promise<X402ReceiptLookup> {
  if (!receiptRedis) return { kind: 'unavailable' };
  try {
    const raw = await receiptRedis.get(receiptKey(receiptId));
    if (raw === null || raw === undefined) return { kind: 'none' };
    const receipt = parseReceipt(raw);
    return receipt ? { kind: 'found', receipt } : { kind: 'none' };
  } catch (error) {
    console.warn('[x402] receipt lookup failed, replay protection off for this call:', (error as Error).message);
    return { kind: 'unavailable' };
  }
}

export type X402ClaimResult =
  | { kind: 'claimed'; token: string }
  | { kind: 'taken'; receipt: X402Receipt | null }
  | { kind: 'unavailable' };

export async function claimX402Receipt(receiptId: string, mint: string): Promise<X402ClaimResult> {
  if (!receiptRedis) return { kind: 'unavailable' };
  const token = randomUUID();
  try {
    const record: X402Receipt = { state: 'held', mint, token };
    const ok = await receiptRedis.set(receiptKey(receiptId), record, { nx: true, ex: RECEIPT_HELD_TTL_SECONDS });
    if (ok === 'OK') return { kind: 'claimed', token };
    const raw = await receiptRedis.get(receiptKey(receiptId));
    return { kind: 'taken', receipt: parseReceipt(raw) };
  } catch (error) {
    console.warn('[x402] receipt claim failed, replay protection off for this call:', (error as Error).message);
    return { kind: 'unavailable' };
  }
}

export async function releaseX402Receipt(receiptId: string, token: string | null): Promise<void> {
  if (!receiptRedis) return;
  try {
    const current = parseReceipt(await receiptRedis.get(receiptKey(receiptId)));
    if (!current) return;
    if (token === null ? current.state === 'settle_timeout' : current.state === 'held' && current.token === token) {
      await receiptRedis.del(receiptKey(receiptId));
    }
  } catch (error) {
    console.warn('[x402] receipt release failed:', (error as Error).message);
  }
}

export async function saveX402Receipt(
  receiptId: string,
  record: { state: 'settled' | 'settle_timeout'; mint: string; transactionHash?: string },
): Promise<void> {
  if (!receiptRedis) return;
  try {
    await receiptRedis.set(receiptKey(receiptId), record, { ex: RECEIPT_DONE_TTL_SECONDS });
  } catch (error) {
    console.warn('[x402] receipt save failed:', (error as Error).message);
  }
}

// Facilitator wording for "this payment already went through".
export function isAlreadySettled(errorReason: string | undefined): boolean {
  return typeof errorReason === 'string' && /already|duplicate|processed/i.test(errorReason);
}
