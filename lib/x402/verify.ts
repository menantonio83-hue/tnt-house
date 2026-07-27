// x402 payment verification helper for RiskDataApi
// Talks to the public x402 facilitator to verify and settle Solana USDC payments
// Does NOT touch existing API-key billing logic — this is an additive payment channel

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';
const RECEIVING_WALLET = process.env.X402_WALLET_ADDRESS || '9p5hBDTrFRzyW4VhKMaq96XCtWkRPA9ZaSTnsM9qvtEE';
const NETWORK = process.env.X402_NETWORK || 'solana'; // 'solana' for mainnet, 'solana-devnet' for testing

export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string; // in USDC atomic units
  resource: string;
  description: string;
  payTo: string;
  asset: string; // USDC mint address
  maxTimeoutSeconds: number;
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

// Build the PaymentRequirements object returned in the 402 response body
export function buildPaymentRequirements(
  resourcePath: string,
  priceUsdcAtomic: string,
  description: string,
): PaymentRequirements {
  return {
    scheme: 'exact',
    network: NETWORK,
    maxAmountRequired: priceUsdcAtomic,
    resource: resourcePath,
    description,
    payTo: RECEIVING_WALLET,
    asset: USDC_MINT_SOLANA,
    maxTimeoutSeconds: 60,
  };
}

// Verify a payment header against the facilitator BEFORE doing settlement
// Prevents wasted settlement calls for malformed/invalid payments
export async function verifyPayment(
  paymentHeader: string,
  requirements: PaymentRequirements,
): Promise<VerifyResult> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader,
        paymentRequirements: requirements,
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
  requirements: PaymentRequirements,
): Promise<SettleResult> {
  try {
    const response = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader,
        paymentRequirements: requirements,
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
