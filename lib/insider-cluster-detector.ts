// Version 7.0 — lib/insider-cluster-detector.ts
//
// v7.0: PERFORMANCE REWRITE. Replaced the per-holder RPC signature walk
// (getSignaturesForAddress pagination + getParsedTransaction balance-
// delta scan — the ~1-2 min bottleneck) with Helius Wallet API's
// GET /v1/wallet/{wallet}/funded-by endpoint: one HTTP call returns a
// wallet's original funder + funding timestamp directly, no RPC paging.
//
// IMPORTANT: /funded-by is a Helius Wallet API endpoint (100 credits per
// call) that requires a PAID Helius plan — Free-plan keys get 403 and
// every call in this file will silently resolve to null (see
// fetchFundedBy). Confirm the HELIUS_API_KEY in use is on a paid tier
// before relying on this in production.
//
// v7.0: holder pipelines now run in parallel via p-limit
// (HOLDER_CONCURRENCY = 8) instead of a sequential for-loop.
//
// v7.0: added a funder "hop" heuristic. A funder wallet is treated as
// CLEAN (tracing stops there) if it is at least CLEAN_FUNDER_MIN_AGE_DAYS
// old AND holds more than CLEAN_FUNDER_MIN_BALANCE_SOL — that profile is
// very unlikely to be a disposable sniper/insider wallet, so it's used
// as-is for cluster grouping. A FRESH or low-balance funder is hopped
// past — its own funder becomes the next candidate — up to
// MAX_HOP_DEPTH hops total, to reach past disposable intermediate
// wallets toward the real originating source.
//
// Standalone "First Funder Trace" insider-cluster detector.
//
// This is a NEW file. It does not modify app/api/cluster-check/route.js —
// that route keeps working exactly as before for the public site.
//
// Why a separate module instead of importing the existing route:
// 1. Next.js route files aren't meant to be imported as libraries.
// 2. cluster-check/route.js has a site-specific side effect — it writes
//    a penalty score into the `listed_tokens` table. A paid Risk-Data API
//    hit by trading bots should NOT trigger that write on every call.
// This module contains only the pure on-chain detection logic, reusable
// by both features going forward.
//
// Logic: for a token's top holders, find each wallet's funding chain via
// Helius funded-by, hop past fresh/thin intermediate wallets, and land
// on a stable funder. If the same funder wallet funded 2+ of the checked
// top holders, that's an on-chain-provable insider/sniper cluster signal
// — no paid third-party API (Nansen/Arkham) needed.

import { Connection, PublicKey } from '@solana/web3.js';
import pLimit from 'p-limit';
import { withTimeout } from '@/lib/with-timeout';

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';
const HELIUS_WALLET_API_URL = 'https://api.helius.xyz/v1/wallet';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

// Safety caps so one request can't hammer Helius/RPC forever.
const MAX_HOLDERS_CHECKED = 10;
const HOLDER_CONCURRENCY = 8; // p-limit: max holder pipelines running at once
const MAX_HOP_DEPTH = 3; // never trace further than this even if every hop looks fresh
const CLEAN_FUNDER_MIN_AGE_DAYS = 30;
const CLEAN_FUNDER_MIN_BALANCE_SOL = 1;
const LAMPORTS_PER_SOL = 1_000_000_000;

const RUGCHECK_TIMEOUT_MS = 10000;
const FUNDED_BY_TIMEOUT_MS = 6000;
const PER_HOLDER_TIMEOUT_MS = 20000; // budget for one holder's whole hop chain (up to 3 sequential calls)

export interface InsiderCluster {
  funder: string;
  wallets: string[];
}

export interface InsiderClusterDetectionResult {
  clusters: InsiderCluster[];
  checkedHolders: number;
  errors: Array<{ holder: string; error: string }>;
}

interface FundedByResponse {
  funder: string;
  timestamp: number; // unix seconds — when this address's funding tx happened
}

// One call to Helius Wallet API — who funded `address`, and when.
// Resolves to null on any non-2xx response (400/401/403/404/429/500) or
// network failure — callers treat null as "tracing stops here", not as
// a hard error, since a missing funding tx (e.g. a fresh empty wallet,
// or a Free-plan key hitting 403) shouldn't kill the whole holder check.
async function fetchFundedBy(address: string): Promise<FundedByResponse | null> {
  if (!HELIUS_API_KEY) return null;

  try {
    const res = await fetch(
      `${HELIUS_WALLET_API_URL}/${address}/funded-by?api-key=${HELIUS_API_KEY}`,
      { signal: AbortSignal.timeout(FUNDED_BY_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.funder !== 'string') return null;
    return { funder: data.funder, timestamp: data.timestamp };
  } catch {
    return null;
  }
}

// Cheap RPC call — current SOL balance only, no signature history walk.
async function fetchBalanceSol(connection: Connection, address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey, 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

// Traces a single holder's first-funder chain, hopping past fresh/thin
// intermediate wallets until a clean funder is found or MAX_HOP_DEPTH is
// reached. Returns the resolved funder address, or null if no funding
// transaction could be found at all (hop 1 already comes back empty).
async function traceFunder(connection: Connection, holder: string): Promise<string | null> {
  const firstHop = await fetchFundedBy(holder);
  if (!firstHop) return null;

  let resolvedFunder = firstHop.funder;

  for (let hop = 1; hop < MAX_HOP_DEPTH; hop++) {
    const [funderOrigin, balanceSol] = await Promise.all([
      fetchFundedBy(resolvedFunder),
      fetchBalanceSol(connection, resolvedFunder),
    ]);

    const ageDays = funderOrigin ? (Date.now() / 1000 - funderOrigin.timestamp) / 86400 : 0;
    const isClean = ageDays >= CLEAN_FUNDER_MIN_AGE_DAYS && balanceSol > CLEAN_FUNDER_MIN_BALANCE_SOL;

    // Clean funder found, OR this wallet has no funding tx of its own
    // (likely pre-history / genesis-funded) — either way, stop here.
    if (isClean || !funderOrigin) break;

    // Fresh / thin-balance funder — hop one level further up the chain.
    resolvedFunder = funderOrigin.funder;
  }

  return resolvedFunder;
}

// Main entry point: detect insider clusters among a mint's top holders.
export async function detectInsiderClusters(
  mint: string,
): Promise<InsiderClusterDetectionResult> {
  const rugRes = await fetch(`${RUGCHECK_URL}/${mint}/report`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(RUGCHECK_TIMEOUT_MS),
  });

  if (!rugRes.ok) {
    throw new Error('Could not fetch holder data for this token (RugCheck upstream error)');
  }

  const rugData = await rugRes.json();
  const topHolders: string[] = (rugData.topHolders || [])
    .slice(0, MAX_HOLDERS_CHECKED)
    .map((h: any) => h.address || h.owner)
    .filter(Boolean);

  if (topHolders.length < 2) {
    return { clusters: [], checkedHolders: topHolders.length, errors: [] };
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const funderMap: Record<string, string[]> = {};
  const errors: Array<{ holder: string; error: string }> = [];
  const limit = pLimit(HOLDER_CONCURRENCY);

  await Promise.all(
    topHolders.map((holder) =>
      limit(async () => {
        try {
          const funder = await withTimeout(
            traceFunder(connection, holder),
            PER_HOLDER_TIMEOUT_MS,
            null,
          );
          if (funder) {
            if (!funderMap[funder]) funderMap[funder] = [];
            funderMap[funder].push(holder);
          }
        } catch (e: any) {
          errors.push({ holder, error: e.message || 'Unknown error' });
        }
      }),
    ),
  );

  // Only surface funders that funded 2+ of the checked top holders —
  // a single shared funding source across multiple top wallets is the
  // real, on-chain-provable insider/cluster signal.
  const clusters: InsiderCluster[] = Object.entries(funderMap)
    .filter(([, wallets]) => wallets.length >= 2)
    .map(([funder, wallets]) => ({ funder, wallets }));

  return { clusters, checkedHolders: topHolders.length, errors };
}
