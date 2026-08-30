// Version 1.0 — app/api/quick-check/credits/route.js
//
// PAYMENT-RELATED — per project rule, do not merge to main without
// explicit "ок" review, same as any other billing code.
//
// Verifies a Solana Pay payment (MRDT / SOL / USDC — same three methods
// the existing Verified/Priority/VIP/Banner flow already accepts) and,
// once confirmed, adds the purchased package's checks to the caller's
// Quick Check credit balance (lib/quick-check-limit.ts).
//
// Verification logic is a deliberate near-duplicate of
// app/api/verify-payment/route.js's Helius transaction lookup — same
// constants, same tokenTransfers/nativeTransfers matching. Not
// importing that route directly (Next.js route handlers aren't meant
// to be called as functions from other routes); duplicating ~25 lines
// here is the same tradeoff the codebase already makes elsewhere
// (submit-audit.js and verify-payment.js both hardcode MRDT_MINT
// independently rather than sharing a module).

import { CREDIT_PACKAGES, addCredits } from '@/lib/quick-check-limit';

const RECIPIENT_WALLET = 'Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z';
const MRDT_MINT = '8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const LAMPORTS_PER_SOL = 1_000_000_000;
const TOLERANCE = 0.95;

const FP_COOKIE = 'tnt_qc_fp';

function extractClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}

function getFingerprint(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${FP_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

async function findMatchingPayment(expectedAmount, sinceMs, method) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return { verified: false, reason: 'HELIUS_API_KEY missing.' };

  const sinceSeconds = Math.floor(sinceMs / 1000) - 10;
  const heliusUrl = `https://api.helius.xyz/v0/addresses/${RECIPIENT_WALLET}/transactions?api-key=${apiKey}&type=TRANSFER&token-accounts=balanceChanged&gte-time=${sinceSeconds}`;

  const response = await fetch(heliusUrl);
  if (!response.ok) return { verified: false, reason: `Helius error: ${response.status}` };

  const transactions = await response.json();
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { verified: false, reason: 'No recent transactions found.' };
  }

  for (const tx of transactions) {
    if (method === 'MRDT' && tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        if (t.mint === MRDT_MINT && t.toUserAccount === RECIPIENT_WALLET) {
          const received = parseFloat(t.tokenAmount ?? t.amount ?? 0);
          if (received >= expectedAmount * TOLERANCE) return { verified: true, signature: tx.signature };
        }
      }
    }
    if (method === 'USDC' && tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        if (t.mint === USDC_MINT && t.toUserAccount === RECIPIENT_WALLET) {
          const received = parseFloat(t.tokenAmount ?? t.amount ?? 0);
          if (received >= expectedAmount * TOLERANCE) return { verified: true, signature: tx.signature };
        }
      }
    }
    if (method === 'SOL' && tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        if (t.toUserAccount === RECIPIENT_WALLET) {
          const receivedSol = (t.amount || 0) / LAMPORTS_PER_SOL;
          if (receivedSol >= expectedAmount * TOLERANCE) return { verified: true, signature: tx.signature };
        }
      }
    }
  }
  return { verified: false, reason: 'No matching transaction found.' };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { packageId, expectedAmount, since, method } = body;

    const pkg = CREDIT_PACKAGES[packageId];
    if (!pkg) return Response.json({ error: 'Invalid packageId' }, { status: 400 });
    if (typeof expectedAmount !== 'number' || typeof since !== 'number') {
      return Response.json({ error: 'Invalid payment parameters' }, { status: 400 });
    }

    const fp = getFingerprint(request);
    if (!fp) {
      // No fingerprint cookie yet means no free checks have ever run for
      // this browser — send them through a Quick Check first so an
      // identity exists to credit.
      return Response.json({ error: 'No Quick Check session found. Run a free check first.' }, { status: 400 });
    }

    const ip = extractClientIp(request);
    const identity = `${ip}:${fp}`;

    const result = await findMatchingPayment(expectedAmount, since, method || 'MRDT');
    if (!result.verified) {
      return Response.json({ verified: false, reason: result.reason }, { status: 402 });
    }

    const newBalance = await addCredits(identity, packageId);
    if (newBalance === null) {
      return Response.json({ verified: true, creditsAdded: false, reason: 'Payment verified but crediting failed — contact admin with tx signature.', signature: result.signature }, { status: 500 });
    }

    return Response.json({ verified: true, creditsAdded: true, checksAdded: pkg.checks, newBalance, signature: result.signature });
  } catch (error) {
    console.error('POST /api/quick-check/credits Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
