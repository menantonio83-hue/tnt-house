// Version 7.2 — lib/billing-verify.ts
//
// Same approach as the existing app/api/verify-payment/route.js (NOT
// modified — this is new, separate code): poll Helius's
// addresses/{wallet}/transactions for a transfer matching the expected
// amount, method, and time window.
//
// Key difference: the site's existing verifier uses a 5% tolerance,
// fine when amounts float naturally with live SOL/MRDT prices. Our
// invoice amounts are deliberately salted to be unique (see
// lib/billing-pricing.ts), so this uses a tight, currency-appropriate
// tolerance instead — loose enough for float rounding, nowhere near
// loose enough to match a different invoice.

const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const LAMPORTS_PER_SOL = 1_000_000_000;

const TOLERANCE: Record<string, number> = {
  SOL: 0.000001, // 1 microSOL
  USDC: 0.00005,
  MRDT: 0.5, // whole-token amounts, half a token covers float rounding only
};

export interface PaymentMatch {
  found: boolean;
  signature?: string;
  received?: number;
  reason?: string;
}

export async function findMatchingPayment(
  expectedAmount: number,
  currency: 'SOL' | 'MRDT' | 'USDC',
  sinceMs: number,
): Promise<PaymentMatch> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return { found: false, reason: 'HELIUS_API_KEY missing' };
  }

  const sinceSeconds = Math.floor(sinceMs / 1000) - 10; // 10s clock-sync buffer, same as the site's verifier
  const heliusUrl = `https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions?api-key=${apiKey}&type=TRANSFER&token-accounts=balanceChanged&gte-time=${sinceSeconds}`;

  let response: Response;
  try {
    response = await fetch(heliusUrl, { signal: AbortSignal.timeout(10000) });
  } catch (e: any) {
    return { found: false, reason: e.message || 'Helius fetch failed' };
  }

  if (!response.ok) {
    return { found: false, reason: `Helius error: ${response.status}` };
  }

  const transactions = await response.json();
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { found: false, reason: 'No recent transactions found' };
  }

  const tolerance = TOLERANCE[currency] ?? 0.00001;

  for (const tx of transactions) {
    if (currency === 'MRDT' && tx.tokenTransfers?.length) {
      for (const transfer of tx.tokenTransfers) {
        if (transfer.mint === MRDT_MINT && transfer.toUserAccount === RECIPIENT_WALLET) {
          const received = parseFloat(transfer.tokenAmount ?? transfer.amount ?? 0);
          if (Math.abs(received - expectedAmount) <= tolerance) {
            return { found: true, signature: tx.signature, received };
          }
        }
      }
    }

    if (currency === 'USDC' && tx.tokenTransfers?.length) {
      for (const transfer of tx.tokenTransfers) {
        if (transfer.mint === USDC_MINT && transfer.toUserAccount === RECIPIENT_WALLET) {
          const received = parseFloat(transfer.tokenAmount ?? transfer.amount ?? 0);
          if (Math.abs(received - expectedAmount) <= tolerance) {
            return { found: true, signature: tx.signature, received };
          }
        }
      }
    }

    if (currency === 'SOL' && tx.nativeTransfers?.length) {
      for (const transfer of tx.nativeTransfers) {
        if (transfer.toUserAccount === RECIPIENT_WALLET) {
          const receivedSol = (transfer.amount || 0) / LAMPORTS_PER_SOL;
          if (Math.abs(receivedSol - expectedAmount) <= tolerance) {
            return { found: true, signature: tx.signature, received: receivedSol };
          }
        }
      }
    }
  }

  return { found: false, reason: 'No matching transaction found' };
}
