// Version 7.4 — lib/insider-cluster-detector.ts
//
// v7.4: distinguish "RugCheck returned no topHolders data" (upstream
// failure — now thrown, so it is never cached as a clean result) from
// "token genuinely has fewer than two holders" (still returned as a
// normal empty-clusters result). Previously both cases silently
// produced checkedHolders: 0 with no error, which let a failed read
// score as "no shared funding source found" and get pinned in the
// 12h cache. See the fix itself, further down, for the full story.
//
// v7.3: every detected cluster is now CLASSIFIED (allowlist +
// composite infra heuristic) so downstream scoring can stop penalizing
// tokens for infrastructure funding patterns. Each cluster carries
// funder_class / funder_label / funder_confidence /
// false_positive_likely. Proxy signals reuse data already fetched by
// the funder hop (funding amount from the parsed funding tx, signature
// page from the getSignaturesForAddress already made for the age
// check); the only new RPC work is one batched getParsedTransactions
// over the funder's recent signatures, and only when the two cheap
// signals (micro transfer + high frequency) already passed. See
// classifyFunder() for the exact rules.
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
import { KNOWN_CEX_FUNDERS } from '@/lib/known-cex-funders';

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
// v7.3 — funder classification thresholds (see classifyFunder).
const FUNDER_CLASSIFY_TIMEOUT_MS = 20000; // budget for one cluster funder's classification
const MICRO_TRANSFER_MAX_SOL = 0.005;
const HIGH_FREQUENCY_SPAN_SECONDS = 3600;
const MASS_FUNDING_MIN_DESTINATIONS = 500;

// v7.3 — funder classification attached to every cluster.
// 'cex' / 'infra' are strong findings (allowlist / all-three-signal
// heuristic); 'likely_exchange_or_infra' is a weaker two-signal
// suspicion; 'unknown' means no usable signal at all.
export type FunderClass = 'cex' | 'infra' | 'likely_exchange_or_infra' | 'unknown';

export interface InsiderCluster {
  funder: string;
  wallets: string[];
  funder_class: FunderClass;
  // Real label ONLY from KNOWN_CEX_FUNDERS — never invented by the
  // heuristic (which leaves this null).
  funder_label: string | null;
  // 1.0 allowlist, 0.8 strong heuristic, 0.5 weak heuristic,
  // null = unknown.
  funder_confidence: number | null;
  // true when the "shared funder = insider control" reading is likely
  // wrong (known CEX/infra source). The cluster stays visible in API
  // responses with this flag; scoring (lib/scoring.ts) skips its
  // penalty.
  false_positive_likely: boolean;
}

export interface InsiderClusterDetectionResult {
  clusters: InsiderCluster[];
  checkedHolders: number;
  errors: Array<{ holder: string; error: string }>;
}

interface OldestSignatureInfo {
  signature: string;
  blockTime: number | null;
  // Newest-first signature sample from the FIRST page fetched — the
  // wallet's most recent txs. Not part of the funder-cache payload:
  // signature history grows, so only in-memory use (funder
  // classification) is correct.
  recentSigs: Array<{ signature: string; blockTime: number | null }>;
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
    const recentSigs =
      page === 0
        ? sigs.map((s) => ({ signature: s.signature, blockTime: s.blockTime ?? null }))
        : [];
    oldest = { signature: last.signature, blockTime: last.blockTime ?? null, recentSigs };
    if (sigs.length < SIG_PAGE_SIZE) break; // fast path — this page was the entire history
    before = oldest.signature;
  }

  return oldest;
}

// Given a wallet's oldest transaction, find which OTHER account's SOL
// balance decreased while this wallet's balance increased — that's the
// real funder, read directly from the transaction's balance deltas.
// Also returns the transferred amount (lamports) — the same parse the
// funder classifier later uses as its micro-transfer signal, so that
// signal costs no extra RPC.
async function findFunderFromTx(
  connection: Connection,
  walletAddress: string,
  signature: string,
): Promise<{ funder: string; amountLamports: number } | null> {
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
      return { funder: accountKeys[i], amountLamports: walletGained };
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
interface ResolvedFunderInfo {
  funder: string;
  blockTime: number | null;
  // Amount this wallet first received from its funder (lamports).
  amountLamports: number | null;
  // Signature sample of THIS wallet (newest first), null when the
  // resolution came from cache — sig history grows, so it is never
  // cached (see findOldestSignature).
  recentSigs: Array<{ signature: string; blockTime: number | null }> | null;
}

async function resolveWalletFunder(
  connection: Connection,
  address: string,
): Promise<ResolvedFunderInfo | null> {
  const cached = await getCachedFunder(address);
  if (cached) {
    return {
      funder: cached.funder,
      blockTime: cached.blockTime,
      amountLamports: cached.amountLamports ?? null,
      recentSigs: null,
    };
  }

  const oldest = await findOldestSignature(connection, new PublicKey(address));
  if (!oldest) return null;

  const funding = await findFunderFromTx(connection, address, oldest.signature);
  if (!funding) return null;

  const result: CachedFunder = {
    funder: funding.funder,
    blockTime: oldest.blockTime,
    amountLamports: funding.amountLamports,
  };
  setCachedFunderAsync(address, result); // fire-and-forget, no TTL — this fact never changes
  return {
    funder: funding.funder,
    blockTime: oldest.blockTime,
    amountLamports: funding.amountLamports,
    recentSigs: oldest.recentSigs,
  };
}

// Traces a single holder's first-funder chain, hopping past fresh/thin
// intermediate wallets until a clean funder is found or MAX_HOP_DEPTH is
// reached. Returns the resolved funder plus the two classification
// inputs the trace already had on hand (no extra RPC here), or null if
// no funding transaction could be found at all.
interface FunderTraceResult {
  funder: string;
  // What the funder sent to its immediate child in the chain
  // (lamports), null when unknown (e.g. pre-v1.3 cache entry).
  transferAmountLamports: number | null;
  // The funder's own recent signature sample, null when it couldn't
  // be captured without extra RPC (cache hit / chain exhausted) —
  // classifyFunder re-fetches it then.
  recentSigs: Array<{ signature: string; blockTime: number | null }> | null;
}

async function traceFunder(connection: Connection, holder: string): Promise<FunderTraceResult | null> {
  const first = await resolveWalletFunder(connection, holder);
  if (!first) return null;

  let resolvedFunder = first.funder;
  let transferAmountLamports = first.amountLamports;
  let recentSigs: FunderTraceResult['recentSigs'] = null;

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
    if (isClean || !funderInfo) {
      // resolvedFunder stays as-is, and the signature sample just
      // fetched for it IS the sample of the final funder.
      recentSigs = funderInfo ? funderInfo.recentSigs : null;
      break;
    }

    // Fresh / thin-balance funder — hop one level further up the chain.
    resolvedFunder = funderInfo.funder;
    transferAmountLamports = funderInfo.amountLamports;
    // The new parent's own signatures are unknown until the next hop
    // resolves it (and the loop may end without ever doing so).
    recentSigs = null;
  }

  return { funder: resolvedFunder, transferAmountLamports, recentSigs };
}

// ─── Funder classification (v7.3) ────────────────────────────────────
//
// Goal: stop the safety_score from penalizing tokens whose "shared
// funder" is really an exchange/infra hot wallet, not a common insider
// owner. Two layers:
//
//   1. Allowlist (lib/known-cex-funders.ts) — verified addresses with
//      real labels. Confidence 1.0, class 'cex'.
//   2. Composite infra heuristic — ALL THREE proxy signals must fire
//      together, so a sniper bot with many txs but few destinations
//      and normal amounts does NOT get filtered:
//        a. micro transfer: the funder dusted this token's holders
//           (< 0.005 SOL each);
//        b. high frequency: the funder's most recent signature page is
//           FULL (>= SIG_PAGE_SIZE txs on record) and spans < 1 hour;
//        c. mass funding out: > 500 unique receivers among those
//           recent transactions.
//      All three -> 'infra' (0.8, false_positive_likely: true).
//      a+b but c could not confirm -> 'likely_exchange_or_infra'
//      (0.5, false_positive_likely: false — still penalized, only a
//      suspicion).
//   3. Anything else -> 'unknown' (confidence null, penalized).
//
// RPC cost: the amount comes from the funding tx already parsed by the
// trace; the signature page comes from the getSignaturesForAddress the
// trace already made for the age check. The ONLY new call is one
// batched getParsedTransactions over the funder's recent signatures,
// and only when signals a+b already passed. On a funder-cache hit the
// signature sample isn't available, so the one already-planned
// getSignaturesForAddress is re-issued (the same call the trace would
// have made on a miss).
interface FunderClassFields {
  funder_class: FunderClass;
  funder_label: string | null;
  funder_confidence: number | null;
  false_positive_likely: boolean;
}

// Same single-call fetch findOldestSignature makes on a cache miss —
// used only when the trace couldn't hand over a signature sample.
async function fetchRecentSigs(
  connection: Connection,
  funder: string,
): Promise<Array<{ signature: string; blockTime: number | null }> | null> {
  try {
    const sigs = await connection.getSignaturesForAddress(new PublicKey(funder), {
      limit: SIG_PAGE_SIZE,
    });
    return sigs.map((s) => ({ signature: s.signature, blockTime: s.blockTime ?? null }));
  } catch {
    return null;
  }
}

// One batched call: parse the funder's recent txs and count unique
// receivers (accounts whose SOL balance went up). Returns null if the
// RPC can't answer — the heuristic then refuses to fire (fail-safe:
// unknown stays penalized).
async function countUniqueDestinations(
  connection: Connection,
  sigs: Array<{ signature: string; blockTime: number | null }>,
): Promise<number | null> {
  try {
    const txs = await connection.getParsedTransactions(
      sigs.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0 },
    );
    const destinations = new Set<string>();
    for (const tx of txs) {
      if (!tx || !tx.meta) continue;
      const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
        typeof k === 'string' ? k : k.pubkey.toString(),
      );
      const pre = tx.meta.preBalances;
      const post = tx.meta.postBalances;
      for (let i = 1; i < accountKeys.length; i++) {
        if ((post[i] ?? 0) - (pre[i] ?? 0) > 0) destinations.add(accountKeys[i]);
      }
    }
    return destinations.size;
  } catch {
    return null;
  }
}

async function classifyFunder(
  connection: Connection,
  funder: string,
  transferAmountSol: number | null,
  recentSigs: Array<{ signature: string; blockTime: number | null }> | null,
): Promise<FunderClassFields> {
  // 1) Allowlist first — verified label, full confidence, and the
  //    "shared funder = insider control" reading treated as wrong.
  if (Object.prototype.hasOwnProperty.call(KNOWN_CEX_FUNDERS, funder)) {
    return {
      funder_class: 'cex',
      funder_label: KNOWN_CEX_FUNDERS[funder],
      funder_confidence: 1.0,
      false_positive_likely: true,
    };
  }

  const sigs = recentSigs && recentSigs.length > 0 ? recentSigs : await fetchRecentSigs(connection, funder);

  const isMicroTransfer = transferAmountSol !== null && transferAmountSol < MICRO_TRANSFER_MAX_SOL;

  let isHighFrequency = false;
  if (sigs && sigs.length >= SIG_PAGE_SIZE) {
    const firstTxTime = sigs[0].blockTime;
    const lastTxTime = sigs[sigs.length - 1].blockTime;
    isHighFrequency =
      firstTxTime !== null &&
      lastTxTime !== null &&
      firstTxTime - lastTxTime >= 0 &&
      firstTxTime - lastTxTime < HIGH_FREQUENCY_SPAN_SECONDS;
  }

  // The expensive signal is measured only when the two cheap ones
  // already passed.
  let isMassFundingOut = false;
  let massFundingMeasured = false;
  if (isMicroTransfer && isHighFrequency && sigs) {
    const uniqueDestinations = await countUniqueDestinations(connection, sigs);
    massFundingMeasured = uniqueDestinations !== null;
    isMassFundingOut =
      massFundingMeasured && (uniqueDestinations as number) > MASS_FUNDING_MIN_DESTINATIONS;
  }

  if (isMicroTransfer && isHighFrequency && isMassFundingOut) {
    return {
      funder_class: 'infra',
      funder_label: null,
      funder_confidence: 0.8,
      false_positive_likely: true,
    };
  }

  // Two strong signals but the third couldn't confirm (or came back
  // negative): worth labeling, NOT worth lifting the penalty.
  if (isMicroTransfer && isHighFrequency && (!massFundingMeasured || !isMassFundingOut)) {
    return {
      funder_class: 'likely_exchange_or_infra',
      funder_label: null,
      funder_confidence: 0.5,
      false_positive_likely: false,
    };
  }

  return {
    funder_class: 'unknown',
    funder_label: null,
    funder_confidence: null,
    false_positive_likely: false,
  };
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

  // v7.4: RugCheck can return 200 OK with an empty/missing topHolders
  // array when the token isn't indexed yet, is mid rate-limit, or the
  // upstream is having a bad moment. That is an upstream failure, not
  // a token that genuinely has fewer than two holders — the two must
  // stay distinguishable (see lib/holder-data-guard.ts's header for the
  // same principle applied to holder-distribution.ts). Silently
  // returning checkedHolders: 0 here let a failed read masquerade as a
  // clean, cacheable "no clusters found" result, which then got pinned
  // in Redis for 12h (writeClusterCache() only caches what this function
  // returns normally, precisely because a thrown error is NOT cached).
  // rugData.holderData?.totalHolders (the count the site's own UI shows
  // as "Holders: N wallets") is a different field from topHolders and
  // can be healthy while topHolders is empty — so it is not a valid
  // substitute check here; only topHolders itself tells us whether the
  // detailed list this function needs actually came back.
  if (!Array.isArray(rugData.topHolders) || rugData.topHolders.length === 0) {
    throw new Error(
      'Could not fetch holder data for this token (RugCheck returned no topHolders data)',
    );
  }

  const topHolders: string[] = rugData.topHolders
    .slice(0, MAX_HOLDERS_CHECKED)
    .map((h: any) => h.address || h.owner)
    .filter(Boolean);

  if (topHolders.length < 2) {
    return { clusters: [], checkedHolders: topHolders.length, errors: [] };
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const funderMap: Record<string, string[]> = {};
  const traceByHolder: Record<string, FunderTraceResult> = {};
  const errors: Array<{ holder: string; error: string }> = [];
  const limit = pLimit(HOLDER_CONCURRENCY);

  await Promise.all(
    topHolders.map((holder) =>
      limit(async () => {
        try {
          const trace = await withTimeout(
            traceFunder(connection, holder),
            PER_HOLDER_TIMEOUT_MS,
            null,
          );
          if (trace) {
            traceByHolder[holder] = trace;
            if (!funderMap[trace.funder]) funderMap[trace.funder] = [];
            funderMap[trace.funder].push(holder);
          }
        } catch (e: any) {
          errors.push({ holder, error: e.message || 'Unknown error' });
        }
      }),
    ),
  );

  // Only surface funders that funded 2+ of the checked top holders —
  // a single shared funding source across multiple top wallets is the
  // real, on-chain-provable insider/cluster signal. Each one is also
  // classified (v7.3) so scoring can tell a real insider link from an
  // exchange/infra funding pattern.
  const clusters: InsiderCluster[] = [];
  for (const [funder, wallets] of Object.entries(funderMap)) {
    if (wallets.length < 2) continue;

    // Micro-transfer signal: EVERY known funding transfer from this
    // funder to a clustered holder was dust (< MICRO_TRANSFER_MAX_SOL).
    // Unknown amounts (old cache entries) fail the signal — safer than
    // guessing. The strictest interpretation is used: the LARGEST of
    // the transfers must still be dust.
    const amountsLamports = wallets
      .map((holder) => traceByHolder[holder]?.transferAmountLamports)
      .filter((a): a is number => typeof a === 'number');
    let transferAmountSol: number | null = null;
    if (amountsLamports.length === wallets.length) {
      transferAmountSol = Math.max(...amountsLamports) / LAMPORTS_PER_SOL;
    }

    // Any trace that resolved this funder also fetched (or cached) its
    // signature sample — take the first non-empty one.
    const recentSigs =
      wallets
        .map((holder) => traceByHolder[holder]?.recentSigs)
        .find((s): s is NonNullable<FunderTraceResult['recentSigs']> => !!s && s.length > 0) ?? null;

    const classification = await withTimeout(
      classifyFunder(connection, funder, transferAmountSol, recentSigs),
      FUNDER_CLASSIFY_TIMEOUT_MS,
      null,
    );

    clusters.push({
      funder,
      wallets,
      funder_class: classification?.funder_class ?? 'unknown',
      funder_label: classification?.funder_label ?? null,
      funder_confidence: classification?.funder_confidence ?? null,
      false_positive_likely: classification?.false_positive_likely ?? false,
    });
  }

  return { clusters, checkedHolders: topHolders.length, errors };
}
