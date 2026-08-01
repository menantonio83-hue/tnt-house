// Version 7.2 — lib/insider-cluster-detector.ts
//
// v7.2: added an optional, TTL-less Upstash Redis cache
// (lib/funder-cache.ts) for the "who funded this wallet" resolution
// step. A wallet's first incoming SOL transfer is a fixed historical
// fact, so once resolved for ANY wallet address — a top holder or an
// intermediate funder hit while tracing a DIFFERENT token entirely — it
// never needs to be resolved via RPC again. This is why the cache is
// keyed by raw wallet address rather than by mint: a whale/market-maker
// wallet that shows up as a funder across many different tokens' holder
// lists now only pays the RPC cost once, ever, across the whole API.
// Fail-open: if the Upstash integration isn't connected, every cache
// call is a no-op and this file behaves exactly like v7.1.
//
// v7.1 (kept): free-tier getSignaturesForAddress with a single-call
// fast path (max page size 1000; only paginates further if that first
// page came back completely full, capped at MAX_SIG_PAGES) instead of
// the paid Helius funded-by endpoint. blockTime is read straight off
// the signature-list entry, no extra getParsedTransaction just to learn
// a wallet's age.
//
// v7.0 (kept): holder pipelines run in parallel via p-limit
// (HOLDER_CONCURRENCY = 8). Funder "hop" heuristic: a funder is CLEAN
// (tracing stops there) if it's >= CLEAN_FUNDER_MIN_AGE_DAYS old AND
// holds more than CLEAN_FUNDER_MIN_BALANCE_SOL — otherwise hop to ITS
// funder, up to MAX_HOP_DEPTH hops total.
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
// Logic: for a token's top holders, find each wallet's first incoming
// SOL transfer (its "funder"), then hop past fresh/thin intermediate
// wallets to land on a stable funder. If the same funder wallet funded
// 2+ of the checked top holders, that's an on-chain-provable insider/
// sniper cluster signal — no paid third-party API (Nansen/Arkham) needed.

import { Connection, PublicKey } from '@solana/web3.js';
import pLimit from 'p-limit';
import { withTimeout } from '@/lib/with-timeout';
import { getCachedFunder, setCachedFunderAsync, type CachedFunder } from '@/lib/funder-cache';

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';

// Safety caps so one request can't hammer the RPC forever on an old/busy wallet.
const MAX_HOLDERS_CHECKED = 10;
const HOLDER_CONCURRENCY = 8; // p-limit: max holder pipelines running at once
const MAX_HOP_DEPTH = 3; // never trace further than this even if every hop looks fresh
const CLEAN_FUNDER_MIN_AGE_DAYS = 30;
const CLEAN_FUNDER_MIN_BALANCE_SOL = 1;
const LAMPORTS_PER_SOL = 1_000_000_000;

const MAX_SIG_PAGES = 3; // 3 * 1000 = up to 3000 signatures back per wallet, worst case
const SIG_PAGE_SIZE = 1000; // RPC max — also the single-call fast-path threshold

const RUGCHECK_TIMEOUT_MS = 10000;
const PER_HOLDER_TIMEOUT_MS = 20000; // budget for one holder's whole hop chain

export interface InsiderCluster {
  funder: string;
  wallets: string[];
}

export interface InsiderClusterDetectionResult {
  clusters: InsiderCluster[];
  checkedHolders: number;
  errors: Array<{ holder: string; error: string }>;
}

interface OldestSignatureInfo {
  signature: string;
  blockTime: number | null;
}

// Finds a wallet's oldest known signature + its blockTime.
// Fast path: if the first page (max size) comes back with FEWER than
// SIG_PAGE_SIZE entries, that page IS the wallet's complete history —
// one RPC call, done. Only wallets whose first page is completely full
// fall through to paging further back, capped at MAX_SIG_PAGES.
async function findOldestSignature(
  connection: Connection,
  pubkey: PublicKey,
): Promise<OldestSignatureInfo | null> {
  let before: string | undefined = undefined;
  let oldest: OldestSignatureInfo | null = null;

  for (let page = 0; page < MAX_SIG_PAGES; page++) {
    const sigs = await connection.getSignaturesForAddress(pubkey, {
      limit: SIG_PAGE_SIZE,
      before,
    });
    if (sigs.length === 0) break;
    const last = sigs[sigs.length - 1];
    oldest = { signature: last.signature, blockTime: last.blockTime ?? null };
    if (sigs.length < SIG_PAGE_SIZE) break; // fast path — this page was the entire history
    before = oldest.signature;
  }

  return oldest;
}

// Given a wallet's oldest transaction, find which OTHER account's SOL
// balance decreased while this wallet's balance increased — that's the
// real funder, read directly from the transaction's balance deltas.
async function findFunderFromTx(
  connection: Connection,
  walletAddress: string,
  signature: string,
): Promise<string | null> {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || !tx.meta) return null;

  const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
    typeof k === 'string' ? k : k.pubkey.toString(),
  );
  const walletIndex = accountKeys.indexOf(walletAddress);
  if (walletIndex === -1) return null;

  const preBalances = tx.meta.preBalances;
  const postBalances = tx.meta.postBalances;
  const walletGained = postBalances[walletIndex] - preBalances[walletIndex];
  if (walletGained <= 0) return null; // this tx wasn't the wallet receiving funds

  // Find an account whose balance dropped by roughly the amount this
  // wallet gained (accounting for a small fee margin).
  for (let i = 0; i < accountKeys.length; i++) {
    if (i === walletIndex) continue;
    const delta = postBalances[i] - preBalances[i];
    if (delta < 0 && Math.abs(delta) >= walletGained * 0.9) {
      return accountKeys[i];
    }
  }
  return null;
}

// Cheap RPC call — current SOL balance only, no signature history walk.
// Never cached — a live balance, unlike a funding source, changes
// constantly.
async function fetchBalanceSol(connection: Connection, address: string): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(address), 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

// Resolves "who funded this wallet, and when" — cache-first. A hit
// skips the RPC signature walk + tx parse entirely. A miss falls back
// to the RPC path and writes the result to cache (fire-and-forget) so
// every OTHER wallet that shares this same funder — in this token's
// holder list, or any future token's — gets a free hit from here on.
async function resolveWalletFunder(
  connection: Connection,
  address: string,
): Promise<CachedFunder | null> {
  const cached = await getCachedFunder(address);
  if (cached) return cached;

  const oldest = await findOldestSignature(connection, new PublicKey(address));
  if (!oldest) return null;

  const funder = await findFunderFromTx(connection, address, oldest.signature);
  if (!funder) return null;

  const result: CachedFunder = { funder, blockTime: oldest.blockTime };
  setCachedFunderAsync(address, result); // fire-and-forget, no TTL — this fact never changes
  return result;
}

// Traces a single holder's first-funder chain, hopping past fresh/thin
// intermediate wallets until a clean funder is found or MAX_HOP_DEPTH is
// reached. Returns the resolved funder address, or null if no funding
// transaction could be found at all.
async function traceFunder(connection: Connection, holder: string): Promise<string | null> {
  const first = await resolveWalletFunder(connection, holder);
  if (!first) return null;

  let resolvedFunder = first.funder;

  for (let hop = 1; hop < MAX_HOP_DEPTH; hop++) {
    const [funderInfo, balanceSol] = await Promise.all([
      resolveWalletFunder(connection, resolvedFunder),
      fetchBalanceSol(connection, resolvedFunder),
    ]);

    const ageDays = funderInfo?.blockTime
      ? (Date.now() / 1000 - funderInfo.blockTime) / 86400
      : 0;
    const isClean = ageDays >= CLEAN_FUNDER_MIN_AGE_DAYS && balanceSol > CLEAN_FUNDER_MIN_BALANCE_SOL;

    // Clean funder found, OR this wallet has no funding tx of its own
    // (e.g. pre-history / genesis-funded) — either way, stop here.
    if (isClean || !funderInfo) break;

    // Fresh / thin-balance funder — hop one level further up the chain.
    resolvedFunder = funderInfo.funder;
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
