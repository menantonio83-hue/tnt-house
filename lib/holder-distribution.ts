// Version 6.13 — lib/holder-distribution.ts
//
// v6.13: real-device test on a live production call (USDC, one of the
// most commonly-queried mints on Solana) showed all 3 retry attempts
// timing out after 5s each -- total ~22s, confirmed in Vercel runtime
// logs as three consecutive "fetch timed out" failures, not a clean
// RPC-side rejection. That's the signature of an overloaded/heavily
// shared free public RPC node silently hanging under load, not a
// genuine "no capacity" answer from a real provider.
//
// RPC_URL previously fell back straight to the fully public,
// unauthenticated api.mainnet-beta.solana.com whenever HELIUS_RPC_URL
// wasn't explicitly set -- the exact same fallback app/api/rpc/route.js
// (existing file, not modified) already has, for the same reason (see
// its own comment about the public RPC causing problems for wallet
// signing). Rather than requiring a second manually-set env var, this
// now also tries deriving a real Helius RPC URL from HELIUS_API_KEY --
// which this project ALREADY has configured and already uses
// successfully all day for lib/billing-verify.ts's Enhanced
// Transactions API calls. Helius's mainnet RPC
// (https://mainnet.helius-rpc.com/?api-key=...) is the same API key,
// same account, same free tier -- not a new paid service, not a new
// secret, just pointing at a resource we already have instead of the
// shared public endpoint. HELIUS_RPC_URL, if explicitly set, still
// takes priority; the fully public endpoint is now only the
// last-resort fallback if neither is configured.
//
// v6.10's retry wrapper around checkHolderDistributionRisk()
// (lib/helius-client.js) did NOT fix the bug in practice — retried BONK
// still came back holder_count: 0. Reasoning through why: that
// function's internal RPC handling collapses BOTH "genuinely zero
// holders" and "RPC call errored/rate-limited" into the identical
// return shape ({ holderCount: 0, ... }), so a caller — even one that
// retries — has no way to tell which happened. On top of that, the
// previous backoff (600ms then 1200ms, ~1.8s total) is nowhere near
// long enough to clear a real public-RPC rate-limit window.
//
// This is a from-scratch implementation of the same on-chain query
// (getTokenLargestAccounts + getTokenSupply) — NOT a wrapper around the
// existing function, and does not modify lib/helius-client.js. Doing it
// directly lets this tell a genuine empty result (valid RPC response,
// no error, truly zero accounts) apart from an RPC-side failure, and
// only retries the latter, with real backoff and real logging on every
// attempt — visible in Vercel function logs — instead of guessing.

const RPC_URL =
  process.env.HELIUS_RPC_URL ||
  (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com');

// Diagnostic only — logs WHICH branch of the fallback above got picked,
// never the actual URL/key value, so we can tell from Vercel logs
// whether v6.13's Helius fallback is actually being reached at all,
// without exposing any secret. Remove once the RPC-timeout issue this
// was added to debug is confirmed resolved.
console.log(
  '[holder-distribution] RPC source:',
  process.env.HELIUS_RPC_URL
    ? 'explicit HELIUS_RPC_URL env var'
    : process.env.HELIUS_API_KEY
      ? 'derived from HELIUS_API_KEY (Helius mainnet RPC)'
      : 'public api.mainnet-beta.solana.com (no Helius env var found)',
);
const MAX_ATTEMPTS = 3;
const BACKOFF_SCHEDULE_MS = [1500, 4000]; // wait before attempt 2, then before attempt 3
const FETCH_TIMEOUT_MS = 5000;

export interface HolderDistributionResult {
  riskLevel: string;
  largestHolderPercent: number;
  top10Percent: number;
  holderCount: number;
}

interface RawHolder {
  address: string;
  amount: string;
}

// NOTE: deliberately a flat interface, not a discriminated union
// ({ ok: true; data } | { ok: false; reason }). This repo's
// tsconfig.json has "strict": false, and under that setting TS's
// narrowing on boolean-literal discriminants is unreliable even for
// this exact pattern — confirmed the same way in lib/api-auth.ts
// (Stage 2). A flat interface with nullable fields sidesteps it.
interface RpcOutcome<T> {
  ok: boolean;
  data: T | null;
  reason: string | null;
}

async function callSolanaRpc(method: string, params: unknown[]): Promise<RpcOutcome<any>> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, data: null, reason: `HTTP ${res.status}` };
    }

    const json = await res.json();

    if (json.error) {
      // An explicit Solana JSON-RPC error object — covers rate limiting
      // and everything else the node can reject a request for. This is
      // a confirmed RPC-side failure, never a legitimate "zero holders"
      // answer, so it's always safe to retry.
      return {
        ok: false,
        data: null,
        reason: `RPC error: ${json.error.message || JSON.stringify(json.error)}`,
      };
    }

    if (!json.result) {
      return { ok: false, data: null, reason: 'RPC response missing result field' };
    }

    return { ok: true, data: json.result, reason: null };
  } catch (e: any) {
    return {
      ok: false,
      data: null,
      reason: e.name === 'TimeoutError' ? 'fetch timed out' : e.message || 'fetch failed',
    };
  }
}

async function fetchHolderSnapshot(
  mint: string,
): Promise<RpcOutcome<{ holders: RawHolder[]; totalSupply: number }>> {
  const largest = await callSolanaRpc('getTokenLargestAccounts', [mint]);
  if (!largest.ok || !largest.data) {
    return { ok: false, data: null, reason: largest.reason ?? 'unknown RPC failure' };
  }

  const holders: RawHolder[] = largest.data.value || [];

  // A genuinely empty largest-accounts list, with NO rpc error and a
  // valid response, means the mint really has no distributed holders
  // yet — trust it immediately, no retry needed, no need to even ask
  // for supply.
  if (holders.length === 0) {
    return { ok: true, data: { holders: [], totalSupply: 0 }, reason: null };
  }

  const supply = await callSolanaRpc('getTokenSupply', [mint]);
  if (!supply.ok || !supply.data) {
    return { ok: false, data: null, reason: supply.reason ?? 'unknown RPC failure' };
  }

  const totalSupply = parseInt(supply.data.value.amount, 10);
  return { ok: true, data: { holders, totalSupply }, reason: null };
}

function classifyRisk(largestHolderPercent: number, top10Percent: number): string {
  if (largestHolderPercent > 20) return 'CRITICAL';
  if (largestHolderPercent > 15) return 'HIGH';
  if (top10Percent > 50) return 'MEDIUM';
  return 'LOW';
}

export async function getHolderDistributionRobust(mint: string): Promise<HolderDistributionResult> {
  let lastFailureReason = 'unknown';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const snapshot = await fetchHolderSnapshot(mint);

    if (snapshot.ok && snapshot.data) {
      const { holders, totalSupply } = snapshot.data;
      console.log(
        `[holder-distribution] ${mint} attempt ${attempt}/${MAX_ATTEMPTS}: ok — ${holders.length} holders, supply=${totalSupply}`,
      );

      if (holders.length === 0) {
        return { riskLevel: 'CRITICAL', largestHolderPercent: 100, top10Percent: 100, holderCount: 0 };
      }

      const withPercent = holders.map((h) => ({
        balance: parseInt(h.amount, 10),
        percent: totalSupply > 0 ? (parseInt(h.amount, 10) / totalSupply) * 100 : 0,
      }));
      const largestHolderPercent = withPercent[0].percent;
      const top10Percent = withPercent.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);

      return {
        riskLevel: classifyRisk(largestHolderPercent, top10Percent),
        largestHolderPercent,
        top10Percent,
        holderCount: withPercent.length,
      };
    }

    lastFailureReason = snapshot.reason ?? 'unknown';
    console.warn(
      `[holder-distribution] ${mint} attempt ${attempt}/${MAX_ATTEMPTS}: RPC failure — ${lastFailureReason}`,
    );

    if (attempt < MAX_ATTEMPTS) {
      const wait = BACKOFF_SCHEDULE_MS[attempt - 1] ?? BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  // Every attempt hit a confirmed RPC-side failure — honestly report
  // "we don't know" (ERROR) rather than the misleading "CRITICAL / 100%
  // concentrated" a genuine zero-holder read would imply.
  console.error(
    `[holder-distribution] ${mint}: all ${MAX_ATTEMPTS} attempts failed, last reason: ${lastFailureReason}`,
  );
  return { riskLevel: 'ERROR', largestHolderPercent: 0, top10Percent: 0, holderCount: 0 };
}
