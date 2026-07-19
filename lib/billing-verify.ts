// Version 7.16 — lib/billing-verify.ts
//
// v7.16: defense-in-depth — findMatchInPage now independently checks
// each transaction's own `timestamp` field against `sinceSeconds`
// instead of relying solely on Helius's `gte-time` query param to have
// filtered correctly. It's unclear from Helius's docs whether gte-time
// is honored consistently across all response shapes/API versions; if
// it were ever silently ignored, a transaction from BEFORE the invoice
// existed could match by coincidence. Cheap to check, no reason not to.
//
// v7.15: two hardening fixes from external security review:
// 1. Failed-transaction check: Helius's enhanced-transaction objects
//    carry a `transactionError` field (null on success, an error object
//    on a failed/reverted tx). Previously unchecked — a transaction that
//    reverted on-chain but still moved through the mempool with a
//    matching nominal transfer amount in its (unexecuted) instructions
//    could have been treated as a valid payment. Now skipped explicitly.
// 2. Pagination: previously only ever looked at the single most recent
//    page (Helius returns at most 100 results per call). If the
//    recipient wallet received more than 100 other transactions since
//    the invoice was created before the real payment came in, the real
//    match could have been sitting on a page we never requested. Now
//    walks up to MAX_PAGES older pages via the `before` cursor, stopping
//    as soon as a match is found or a short page signals no more data.
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

// Helius returns at most 100 transactions per call. MAX_PAGES bounds
// total work per verify-payment poll (500 transactions / ~5 Helius
// calls worst case) — a wallet receiving more than that many OTHER
// transfers in the window between invoice creation and payment is an
// edge case not handled here; documented, not silently unbounded.
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

export interface PaymentMatch {
  found: boolean;
  signature?: string;
  received?: number;
  reason?: string;
}

function isFailedTx(tx: any): boolean {
  // Helius enhanced-transactions: `transactionError` is null on success,
  // an error object (or occasionally a truthy non-null value) if the
  // transaction reverted on-chain. A reverted tx never actually moved
  // funds and must never count as a payment match.
  return tx.transactionError != null;
}

async function fetchHeliusPage(
  apiKey: string,
  sinceSeconds: number,
  before: string | undefined,
): Promise<{ transactions: any[] | null; reason?: string }> {
  const url = new URL(`https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('type', 'TRANSFER');
  url.searchParams.set('token-accounts', 'balanceChanged');
  url.searchParams.set('gte-time', String(sinceSeconds));
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (before) url.searchParams.set('before', before);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  } catch (e: any) {
    return { transactions: null, reason: e.message || 'Helius fetch failed' };
  }

  if (!response.ok) {
    return { transactions: null, reason: `Helius error: ${response.status}` };
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return { transactions: null, reason: 'Unexpected Helius response shape' };
  }
  return { transactions: data };
}

function findMatchInPage(
  transactions: any[],
  expectedAmount: number,
  currency: 'SOL' | 'MRDT' | 'USDC',
  tolerance: number,
  sinceSeconds: number,
): PaymentMatch | null {
  for (const tx of transactions) {
    if (isFailedTx(tx)) continue;

    // Defense-in-depth: don't rely solely on Helius's gte-time query
    // param having filtered correctly — independently skip anything
    // that claims to predate the invoice.
    if (typeof tx.timestamp === 'number' && tx.timestamp < sinceSeconds) continue;

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
  return null;
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
  const tolerance = TOLERANCE[currency] ?? 0.00001;

  let before: string | undefined;
  let lastReason = 'No matching transaction found';

  for (let page = 0; page < MAX_PAGES; page++) {
    const { transactions, reason } = await fetchHeliusPage(apiKey, sinceSeconds, before);

    if (!transactions) {
      // A transient fetch/parse error on this page — stop paginating
      // rather than risk skipping past the real match on a retry with a
      // shifted cursor; the client's poll loop will just try again.
      return { found: false, reason: reason || 'Helius fetch failed' };
    }

    if (transactions.length === 0) {
      lastReason = page === 0 ? 'No recent transactions found' : lastReason;
      break; // exhausted — no more pages to walk
    }

    const match = findMatchInPage(transactions, expectedAmount, currency, tolerance, sinceSeconds);
    if (match) return match;

    if (transactions.length < PAGE_LIMIT) break; // short page — this was the last one

    before = transactions[transactions.length - 1].signature;
  }

  return { found: false, reason: lastReason };
}
