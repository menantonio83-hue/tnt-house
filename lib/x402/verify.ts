// Version 1.2 — lib/x402/verify.ts
//
// x402 payment verification helper for RiskDataApi
// Talks to the public x402 facilitator to verify and settle Solana USDC payments
// Does NOT touch existing API-key billing logic — this is an additive payment channel
//
// v1.2: migrated PaymentRequirements to the x402 v2 spec shape. Directory
// scanners (x402scan) reject v1-shaped responses outright ("x402 v1
// response detected — migrate to v2 spec"). Changes: x402Version 2,
// network as a CAIP-2 identifier instead of a bare chain name, `amount`
// field instead of `maxAmountRequired`, `resource` as a structured
// object instead of a bare string.

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const RECEIVING_WALLET = process.env.X402_WALLET_ADDRESS || '9p5hBDTrFRzyW4VhKMaq96XCtWkRPA9ZaSTnsM9qvtEE';
// CAIP-2 identifier for Solana mainnet (genesis-hash based, per the x402
// v2 spec's network identifier convention) — not just the string "solana".
const NETWORK_CAIP2 = process.env.X402_NETWORK_CAIP2 || 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

export interface ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface PaymentRequirement {
  scheme: 'exact';
  network: string; // CAIP-2 identifier, e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
  amount: string; // in USDC atomic units
  asset: string; // USDC mint address
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
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

const USDC_MINT_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // official USDC mint on Solana mainnet

// Build the v2-shaped 402 response body
export function buildPaymentRequiredBody(
  resourcePath: string,
  priceUsdcAtomic: string,
  description: string,
  errorMessage?: string,
): PaymentRequiredBody {
  const fullUrl = `https://www.tnt-audit.com${resourcePath}`;
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
        extra: { name: 'USDC', version: '2' },
      },
    ],
  };
}

// Verify a payment header against the facilitator BEFORE doing settlement
// Prevents wasted settlement calls for malformed/invalid payments
export async function verifyPayment(
  paymentHeader: string,
  requirement: PaymentRequirement,
): Promise<VerifyResult> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentHeader,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      return { isValid: false, errorReason: `Facilitator verify failed: ${response.status}` };
    }

    const data = await response.json();
    return { isValid: data.isValid === true, errorReason: data.invalidReason };
  } catch (error) {
    return { isValid: false, errorReason: `Verify request error: ${(error as Error).message}` };
  }
}

// Settle the payment on-chain via the facilitator after verification passes
export async function settlePayment(
  paymentHeader: string,
  requirement: PaymentRequirement,
): Promise<SettleResult> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentHeader,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      return { success: false, errorReason: `Facilitator settle failed: ${response.status}` };
    }

    const data = await response.json();
    return { success: data.success === true, transactionHash: data.transaction };
  } catch (error) {
    return { success: false, errorReason: `Settle request error: ${(error as Error).message}` };
  }
}
