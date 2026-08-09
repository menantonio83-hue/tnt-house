// Version 6.18 — lib/holder-distribution.ts
//
// v6.18: exposes totalSupply on the return object — previously computed
// internally but never returned. Needed by lib/vesting-lock-detector.ts
// to convert a Streamflow stream's raw depositedAmount (token base
// units) into a percent-of-supply figure, without a second, duplicate
// getTokenSupply RPC call for the same mint.
//
// Version 6.17 — lib/holder-distribution.ts
//
// v6.17: fixed a real bug (not just a stale-audit-timing story) behind
// top10Percent/largestHolderPercent readings that exceeded 100% —
// mathematically impossible for real circulating supply, but observed
// live on a token that had just gone through a large burn. Root cause:
// getTokenLargestAccounts and getTokenSupply are two SEPARATE RPC
// calls, and getTokenLargestAccounts is documented above (v6.15/6.16)
// as the expensive one — served from an index that can lag behind the
// node's live state. Right after a large burn, getTokenSupply reflects
// the new, much smaller supply instantly, while getTokenLargestAccounts
// can still return the OLD (larger) holder balances from before the
// burn for a short window. Old numerator / new tiny denominator =
// impossible percentages like 243%. This is a real synchronization gap
// between two calls, not the mint's actual state, and re-running the
// whole audit didn't fix it before this patch because both calls were
// always re-issued fresh, hitting the same lagging index again.
//
// Fix: after computing a result, if top10Percent or
// largestHolderPercent is over 100 (impossible), re-fetch ONLY
// getTokenLargestAccounts (totalSupply is the cheap/fresh call and
// already confirmed correct — no need to refetch it) after a short
// backoff, up to STALE_RETRY_MAX times. The largest-accounts index
// typically catches up within a few seconds of a burn. If it's still
// inconsistent after all stale-retries, return the best (lowest,
// least-impossible) reading observed instead of silently displaying
// a number that cannot be true, and log a warning so this stays
// visible in Vercel logs rather than a silent bad number reaching a
// paying user.
//
// Version 6.16 — lib/holder-distribution.ts
//
// v6.16: found a hard, hopeless-to-retry RPC rejection for extremely
// high-holder-count mints (confirmed on USDC via real-device testing):
// "Too many accounts requested (5000000 pubkeys), try adding filters to
// narrow down results" — an EXPLICIT node-side refusal to even attempt
// the query, not a timeout or a flaky transient failure. Retrying this
// specific error can never succeed (the node isn't going to change its
// mind about the mint's size between attempts), so it no longer costs
// a full retry cycle — detected and fast-failed immediately, skipping
// the backoff and second attempt entirely. Turns the worst case for
// mints like USDC from ~20-30s of pointless waiting into a
// near-instant, honest ERROR. Every other failure reason (timeouts,
// generic RPC errors, rate limits) still gets the full retry treatment
// from v6.15, since those genuinely can succeed on a second attempt.
//
// Considered switching to Helius's own getTokenAccounts (DAS API,
// queryable by mint, not just owner) as a different data source
// entirely, since it's specifically Helius-indexed rather than a raw
// node scan. Did not adopt it: it paginates at 1000 accounts per call
// with no balance-based sorting, so getting an accurate top-holder
// read for a mint with 100k+ accounts (exactly the USDC-scale case
// this is about) would mean paginating through all of them anyway —
// same fundamental cost as the rejected query, just spread across many
// calls instead of one. Not adopted for this specific top-N-by-balance
// use case; may be worth reconsidering for a different feature that
// genuinely needs the full holder list rather than just concentration.
//
// Version 6.15 — lib/holder-distribution.ts
//
// v6.15: root cause fully confirmed via real-device testing today —
// NOT a bad RPC provider (reproduced identically on the public RPC AND
// on Helius's own mainnet RPC using a key proven working all day for
// other calls). getTokenLargestAccounts is a genuinely expensive query
// for high-holder-count mints (USDC has tens of thousands of active
// token accounts) and can legitimately take longer than the previous
// 5s-per-call budget, regardless of provider — confirmed by
// `e.name === 'TimeoutError'` in every failure, meaning OUR OWN
// AbortSignal was what cut every attempt off, not an upstream error.
//
// Rebalanced the timeout budget instead of chasing another provider:
// getTokenLargestAccounts (the expensive call) now gets a dedicated,
// longer budget; getTokenSupply (a cheap, simple call, never observed
// to be the actual bottleneck) keeps a short one. Dropped from 3
// attempts to 2 — worse odds of "eventually getting lucky within a too-
// short window," but each individual attempt now has a real chance of
// succeeding instead of hitting the same too-tight ceiling three times.
// Worst case: 2 x (10s + 5s) + one 2s backoff = 32s, still comfortably
// inside the outer 40s budget (HOLDER_RISK_TIMEOUT_MS in
// app/api/v1/token-risk/route.ts) with ~8s of margin for everything
// else (JSON parsing, promise scheduling, etc).
//
// Also settled RPC_URL: derive from HELIUS_API_KEY (this project's
// already-configured, already-proven-working-all-day key for
// lib/billing-verify.ts's calls) ahead of whatever HELIUS_RPC_URL
// already holds — same account, same free tier, no new cost. The
// temporary diagnostic logging that traced this down has been removed
// now that the question it existed to answer is settled.
//
// v6.10's retry wrapper around checkHolderDistributionRisk()
// (lib/helius-client.js) did NOT fix the bug in practice — that
// function's internal RPC handling collapses BOTH "genuinely zero
// holders" and "RPC call errored/rate-limited" into the identical
// return shape, so a caller has no way to tell which happened. This
// remains a from-scratch implementation of the same on-chain query
// (getTokenLargestAccounts + getTokenSupply) — NOT a wrapper around the
// existing function, and does not modify lib/helius-client.js — so a
// genuine empty result (valid RPC response, no error, truly zero
// accounts) can be told apart from an RPC-side failure, with real
// logging on every attempt visible in Vercel function logs.

import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// v6.17: not every project "burns" via the actual SPL Burn instruction
// (which reduces mint.supply directly and leaves no token account
// behind). Some send tokens to a well-known, unrecoverable wallet
// instead — most commonly Solana's community "Incinerator" address.
// That wallet still HOLDS the tokens in a normal token account, so it
// can legitimately show up as the #1 "largest account" in
// getTokenLargestAccounts, inflating largestHolderPercent/top10Percent
// with tokens that are functionally dead, not a real risk-relevant
// holder. Solscan and similar explorers exclude these from
// "circulating"/concentration figures — we should too.
const KNOWN_BURN_WALLETS = [
  '1nc1nerator11111111111111111111111111111', // Solana community Incinerator
];

async function getKnownBurnTokenAccounts(mint: string): Promise<Set<string>> {
  const mintKey = new PublicKey(mint);
  const excluded = new Set<string>();
  for (const wallet of KNOWN_BURN_WALLETS) {
    try {
      const ata = await getAssociatedTokenAddress(mintKey, new PublicKey(wallet), true);
      excluded.add(ata.toBase58());
    } catch {
      // Malformed mint or PDA derivation failure — skip silently,
      // this is a best-effort exclusion, not a hard requirement.
    }
  }
  return excluded;
}

function excludeBurnAddresses(holders: RawHolder[], burnAccounts: Set<string>): RawHolder[] {
  if (burnAccounts.size === 0) return holders;
  return holders.filter((h) => !burnAccounts.has(h.address));
}

const RPC_URL = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

const MAX_ATTEMPTS = 2;
const BACKOFF_MS = 2000; // wait before the 2nd (final) attempt
const LARGEST_ACCOUNTS_TIMEOUT_MS = 10000; // the expensive call — generous budget for high-holder-count mints like USDC
const SUPPLY_TIMEOUT_MS = 5000; // cheap, simple call — never observed to be the actual bottleneck

// v6.17: when top10Percent/largestHolderPercent comes back over 100%
// (impossible for real circulating supply), it means
// getTokenLargestAccounts served a stale index — typically right after
// a large burn. totalSupply is NOT re-fetched here since it's the
// cheap/fresh call and already correct; only the holder snapshot is
// retried until the index catches up or we run out of attempts.
const STALE_RETRY_MAX = 3;
const STALE_RETRY_BACKOFF_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Solana/Helius's exact wording for this hard, node-side refusal — seen
// verbatim in Vercel logs on a real USDC request: "Too many accounts
// requested (5000000 pubkeys), try adding filters to narrow down
// results". Matching on the stable "too many accounts" substring
// (case-insensitive) rather than the full message, since the pubkey
// count is mint-specific and will vary.
function isUnretriableMintSizeLimit(reason: string | null): boolean {
  return !!reason && reason.toLowerCase().includes('too many accounts');
}

export interface HolderDistributionResult {
  riskLevel: string;
  largestHolderPercent: number;
  top10Percent: number;
  holderCount: number;
  totalSupply: number;
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

async function callSolanaRpc(method: string, params: unknown[], timeoutMs: number): Promise<RpcOutcome<any>> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
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
      reason: e.name === 'TimeoutError' ? `fetch timed out (${timeoutMs}ms budget)` : e.message || 'fetch failed',
    };
  }
}

async function fetchHolderSnapshot(
  mint: string,
): Promise<RpcOutcome<{ holders: RawHolder[]; totalSupply: number }>> {
  const largest = await callSolanaRpc('getTokenLargestAccounts', [mint], LARGEST_ACCOUNTS_TIMEOUT_MS);
  if (!largest.ok || !largest.data) {
    return { ok: false, data: null, reason: largest.reason ?? 'unknown RPC failure' };
  }

  const rawHolders: RawHolder[] = largest.data.value || [];
  const burnAccounts = await getKnownBurnTokenAccounts(mint);
  const holders = excludeBurnAddresses(rawHolders, burnAccounts);

  // A genuinely empty largest-accounts list, with NO rpc error and a
  // valid response, means the mint really has no distributed holders
  // yet — trust it immediately, no retry needed, no need to even ask
  // for supply.
  if (holders.length === 0) {
    return { ok: true, data: { holders: [], totalSupply: 0 }, reason: null };
  }

  const supply = await callSolanaRpc('getTokenSupply', [mint], SUPPLY_TIMEOUT_MS);
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
        return {
          riskLevel: 'CRITICAL',
          largestHolderPercent: 100,
          top10Percent: 100,
          holderCount: 0,
          totalSupply,
        };
      }

      const withPercent = holders.map((h) => ({
        balance: parseInt(h.amount, 10),
        percent: totalSupply > 0 ? (parseInt(h.amount, 10) / totalSupply) * 100 : 0,
      }));
      let largestHolderPercent = withPercent[0].percent;
      let top10Percent = withPercent.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);
      let holderCount = withPercent.length;

      // Impossible reading (>100%) — almost always a stale
      // getTokenLargestAccounts index right after a burn (see v6.17
      // note above). Re-fetch just the holder snapshot; totalSupply
      // already confirmed fresh above, no need to ask again.
      if (largestHolderPercent > 100 || top10Percent > 100) {
        console.warn(
          `[holder-distribution] ${mint}: impossible reading (top10=${top10Percent.toFixed(1)}%, largest=${largestHolderPercent.toFixed(1)}%) — likely stale largest-accounts index after a burn, retrying holder snapshot only`,
        );

        for (let staleRetry = 1; staleRetry <= STALE_RETRY_MAX; staleRetry++) {
          await sleep(STALE_RETRY_BACKOFF_MS);

          const retryLargest = await callSolanaRpc('getTokenLargestAccounts', [mint], LARGEST_ACCOUNTS_TIMEOUT_MS);
          if (!retryLargest.ok || !retryLargest.data) {
            console.warn(
              `[holder-distribution] ${mint}: stale-retry ${staleRetry}/${STALE_RETRY_MAX} RPC failure — ${retryLargest.reason ?? 'unknown'}`,
            );
            continue;
          }

          const rawRetryHolders: RawHolder[] = retryLargest.data.value || [];
          const retryHolders = excludeBurnAddresses(rawRetryHolders, await getKnownBurnTokenAccounts(mint));
          if (retryHolders.length === 0) continue;

          const retryWithPercent = retryHolders.map((h) => ({
            balance: parseInt(h.amount, 10),
            percent: totalSupply > 0 ? (parseInt(h.amount, 10) / totalSupply) * 100 : 0,
          }));
          const retryLargestPercent = retryWithPercent[0].percent;
          const retryTop10Percent = retryWithPercent.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);

          console.log(
            `[holder-distribution] ${mint}: stale-retry ${staleRetry}/${STALE_RETRY_MAX} — top10=${retryTop10Percent.toFixed(1)}%, largest=${retryLargestPercent.toFixed(1)}%`,
          );

          // Index caught up to a sane reading — use it and stop retrying.
          if (retryLargestPercent <= 100 && retryTop10Percent <= 100) {
            largestHolderPercent = retryLargestPercent;
            top10Percent = retryTop10Percent;
            holderCount = retryWithPercent.length;
            break;
          }

          // Still impossible, but keep the least-impossible reading seen
          // so far in case every retry stays stale — better than
          // silently keeping the very first (often worst) number.
          if (retryTop10Percent < top10Percent) {
            largestHolderPercent = retryLargestPercent;
            top10Percent = retryTop10Percent;
            holderCount = retryWithPercent.length;
          }
        }

        if (largestHolderPercent > 100 || top10Percent > 100) {
          console.warn(
            `[holder-distribution] ${mint}: still impossible after ${STALE_RETRY_MAX} stale-retries (top10=${top10Percent.toFixed(1)}%) — returning best-effort reading, largest-accounts index has not caught up yet`,
          );
        }
      }

      return {
        riskLevel: classifyRisk(largestHolderPercent, top10Percent),
        largestHolderPercent,
        top10Percent,
        holderCount,
        totalSupply,
      };
    }

    lastFailureReason = snapshot.reason ?? 'unknown';

    if (isUnretriableMintSizeLimit(lastFailureReason)) {
      // Confirmed hard node-side refusal, not a flaky failure — no
      // point spending the backoff + a second attempt on a request the
      // node has already explicitly said it won't do. Fail fast.
      console.warn(
        `[holder-distribution] ${mint}: hard mint-size limit hit on attempt ${attempt}/${MAX_ATTEMPTS}, not retrying — ${lastFailureReason}`,
      );
      break;
    }

    console.warn(
      `[holder-distribution] ${mint} attempt ${attempt}/${MAX_ATTEMPTS}: RPC failure — ${lastFailureReason}`,
    );

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS));
    }
  }

  // Either every attempt hit a confirmed RPC-side failure, or we fast-
  // failed on a confirmed hard mint-size limit (logged separately
  // above, distinguishable in Vercel logs) — either way, honestly
  // report "we don't know" (ERROR) rather than the misleading
  // "CRITICAL / 100% concentrated" a genuine zero-holder read would imply.
  console.error(`[holder-distribution] ${mint}: giving up, last reason: ${lastFailureReason}`);
  return { riskLevel: 'ERROR', largestHolderPercent: 0, top10Percent: 0, holderCount: 0, totalSupply: 0 };
}
