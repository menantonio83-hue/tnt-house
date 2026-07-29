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
      return { success: false, errorReason: `facilitator_error_${response.status}` };
    }

    const data = await response.json();
    return {
      success: data.success === true,
      transactionHash: data.transaction ?? data.transactionHash ?? data.txHash,
      errorReason: data.errorReason,
    };
  } catch (error) {
    console.error('[x402] /settle request error:', (error as Error).message);
    return { success: false, errorReason: 'facilitator_unreachable' };
  }
}
