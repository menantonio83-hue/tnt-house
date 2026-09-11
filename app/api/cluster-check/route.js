// app/api/cluster-check/route.js
// Version 1.10
//
// FIX v1.10: funders present in lib/known-cex-funders.ts are excluded
// from cluster matching. No live free API for Solana CEX wallet labels
// exists (checked Helius Wallet Identity — paid only; checked Vybe
// Network labeled-accounts — also paid-tier only despite Vybe having a
// free plan), so that file starts empty and is grown by hand, address by
// verified address — see its header for the process. This filter is
// mostly a backstop for newer/lower-traffic exchange deposit addresses:
// v1.9 below already excludes any holder whose first transaction
// couldn't be confirmed, which covers essentially every established CEX
// hot wallet on its own (they're all old, busy addresses).
//
// FIX v1.9: findOldestSignature used to return whatever signature it saw
// oldest within its page budget (MAX_SIG_PAGES * SIG_PAGE_SIZE = 3000)
// and the rest of the trace treated that as a confirmed first
// transaction. For any wallet with deeper history than that — which
// includes exactly the CEX/bridge hot wallets most likely to fund
// multiple unrelated top holders — the signature returned was an
// arbitrary mid-history transaction, and the "funder" read off it was
// not the wallet's real first funder. Now that case returns
// { truncated: true }; those holders are excluded from cluster matching
// entirely and reported separately as `unconfirmed`, rather than
// silently contributing a wrong funder or a false "no funder found".
//
// FIX v1.8: this route used to end every trace by forcibly setting
// listed_tokens.score to a flat 39 whenever clusterCount > 0 (see removed
// applyClusterScorePenalty, kept in git history if it's ever needed for
// reference). That write ran on BOTH fresh traces and cache hits, so it
// re-applied itself on every single page load of an already-audited
// token — permanently pinning the number at 39 no matter what
// lib/scoring.ts (the project's declared single source of truth for the
// score, per that file's own header) had actually computed.
//
// It also could not have been fixed by making the constant smarter,
// because the bug was architectural, not numerical: this route has no
// visibility into the caps (maturity, market health, wash trading,
// contract risk, rugged) that were already applied when the stored score
// was first computed. Overwriting with ANY number computed here — 39,
// or a "smarter" recomputed one — risks landing above a cap that should
// still bind, which is exactly the class of bug lib/scoring.ts's header
// warns about: a second place computing (or in this case, mutating) a
// score drifts from the first.
//
// So this route no longer writes to listed_tokens.score at all. It only
// traces and reports clusters. The correct fix — making a fresh audit's
// score reflect REAL cluster data from the start, instead of the
// 'pending' placeholder (+12 flat, see lib/scoring.ts) app/page.js
// currently passes to computeFullScore before this route ever runs — is
// an ordering change in the audit flow (trace clusters BEFORE scoring,
// not after) and is tracked as a separate follow-up, not bundled here.

// FIX v1.6: this endpoint walks up to 10 holders' signature history over
// RPC (up to 3 pages of 1000 sigs each, plus a getParsedTransaction per
// holder) — genuinely slow, and now runs automatically on EVERY audit
// submission (v1.102 merged it into the main flow instead of only
// on-demand). Confirmed via Vercel runtime logs: a 502 on this exact
// route, right after that change shipped — almost certainly the default
// serverless function timeout (10s) being too short now that this runs
// far more often. maxDuration explicitly raised to give it real headroom.
export const maxDuration = 60;

// First Funder Trace: for a token's top holders, find each wallet's very
// first incoming SOL transfer (its "funder"). If multiple top holders
// were funded by the SAME wallet, that's a real, on-chain-provable signal
// they're controlled by the same person — a classic insider/sniper
// cluster pattern for fresh Solana memecoins.
//
// No third-party paid API (Nansen/Arkham) needed — just raw Solana RPC
// (getSignaturesForAddress + getTransaction), which Helius's free tier
// covers fine for the shallow history typical of fresh token holders.
//
// FIX v1.7: this route had no auth, no rate limit and no cache, while a
// single GET fans out to as many as 41 upstream calls. Anyone who found
// the URL could drain the Helius quota the whole site depends on. Now:
//
//   1. Results are cached for 12h per mint (lib/cluster-check-cache.ts).
//      A first funder is a historical fact and does not change; only the
//      top-holder set drifts, slowly. Cache hits cost zero RPC.
//   2. The rate limit applies ONLY to cache misses — the requests that
//      actually spend credits. 10/hour and 20/day per IP, 200/day global.
//   3. Hitting the limit returns 429 with a human-readable `error`
//      string, which app/page.js already renders. No silent degradation:
//      the user is told the tracer is paused, never shown an empty or
//      fake "no clusters found" result.
//
// The listed_tokens score penalty below runs on BOTH the cached and the
// freshly-traced path. It must not be skipped on a cache hit: the first
// trace can legitimately run before the token's row exists (the caller
// creates the row and calls this in sequence), in which case the penalty
// had nothing to write to. Re-applying it every time is cheap — two
// Supabase queries, no RPC — and closes that gap.

import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  readClusterCache,
  writeClusterCache,
  allowExpensiveClusterCheck,
  extractClientIp,
} from '@/lib/cluster-check-cache';
import { KNOWN_CEX_FUNDERS } from '@/lib/known-cex-funders';

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';

// Safety caps so one request can't hammer the RPC forever on an old/busy wallet.
const MAX_HOLDERS_CHECKED = 10;
const MAX_SIG_PAGES = 3; // 3 * 1000 = up to 3000 signatures back per wallet
const SIG_PAGE_SIZE = 1000;

// CORS v1.1: this route no longer advertises Access-Control-Allow-Origin.
// It is the insider-cluster trace, called from our own pages, same-origin, and it identifies the
// caller by IP or browser fingerprint rather than by a key. A wildcard
// let any other website make ITS visitors spend this quota, with the
// cost landing on the visitor's identity instead of the attacker's.
// Kept as one place to add response headers if any are ever needed.
const RESPONSE_HEADERS = {};

// Walk a wallet's signature history backwards (oldest last) to find its
// very first transaction signature.
//
// FIX v1.9: this used to return the oldest signature it happened to see
// within MAX_SIG_PAGES and call that "the first transaction" — no
// distinction between "genuinely reached the start of history" (last
// page shorter than SIG_PAGE_SIZE) and "hit the page cap with more
// history still behind it" (last page exactly SIG_PAGE_SIZE). For any
// wallet with more than MAX_SIG_PAGES * SIG_PAGE_SIZE (3000) signatures
// — which includes exactly the CEX/bridge hot wallets this trace most
// needs to not misjudge — the "oldest" signature returned was an
// arbitrary transaction from partway through its history, not its real
// first one. findFunderFromTx then read whatever account happened to
// fund THAT transaction and reported it as "the funder", which is not a
// meaningful signal for an old, busy wallet.
//
// Now the truncated case is reported honestly instead of silently
// answered: { truncated: true } tells the caller this wallet's true
// first funder is unknown, not that it has none. The caller must treat
// that as "no usable signal" — never as either a confirmed funder or a
// confirmed absence of one. Page/size budget is intentionally left
// unchanged: raising it to always reach genuine history would multiply
// RPC cost precisely on the busiest (most likely CEX) wallets, the
// opposite of what the rate limiting elsewhere in this file exists to
// prevent.
async function findOldestSignature(connection, pubkey) {
  let before = undefined;
  let oldest = null;
  for (let page = 0; page < MAX_SIG_PAGES; page++) {
    const sigs = await connection.getSignaturesForAddress(pubkey, {
      limit: SIG_PAGE_SIZE,
      before,
    });
    if (sigs.length === 0) break;
    oldest = sigs[sigs.length - 1];
    if (sigs.length < SIG_PAGE_SIZE) {
      // Reached the actual start of history — this IS the first tx.
      return { signature: oldest.signature, truncated: false };
    }
    before = oldest.signature;
  }
  // Hit the page cap without ever seeing a short page: there is more
  // history behind `oldest` that was never fetched. Whatever `oldest`
  // is, it is not confirmed to be the wallet's first transaction.
  return { signature: oldest ? oldest.signature : null, truncated: oldest !== null };
}

// Given a wallet's first transaction, find which OTHER account's SOL
// balance decreased while this wallet's balance increased — that's the
// real funder, read directly from the transaction's balance deltas.
async function findFunderFromTx(connection, walletAddress, signature) {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || !tx.meta) return null;
  const accountKeys = tx.transaction.message.accountKeys.map((k) =>
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

// Run the actual trace. Returns { checked, clusters, clusterCount, errors }
// or null if the token has too little holder data to say anything.
async function traceClusters(ca) {
  const rugRes = await fetch(RUGCHECK_URL + '/' + ca + '/report', {
    headers: { Accept: 'application/json' },
  });
  if (!rugRes.ok) {
    return { upstreamFailed: true };
  }
  const rugData = await rugRes.json();
  const topHolders = (rugData.topHolders || [])
    .slice(0, MAX_HOLDERS_CHECKED)
    .map((h) => h.address || h.owner)
    .filter(Boolean);

  if (topHolders.length < 2) {
    return { insufficient: true, checked: topHolders.length };
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const funderMap = {}; // funder address -> [holder addresses]
  const errors = [];
  // v1.9: holders whose true first transaction is unconfirmed (history
  // deeper than the page budget) — excluded from cluster matching, but
  // reported separately so a caller can see the trace was incomplete
  // rather than reading a clean "no cluster" as if it were confirmed.
  const unconfirmed = [];

  for (const holder of topHolders) {
    try {
      const pubkey = new PublicKey(holder);
      const oldest = await findOldestSignature(connection, pubkey);
      if (oldest.truncated) {
        unconfirmed.push(holder);
        continue;
      }
      if (!oldest.signature) continue;
      const funder = await findFunderFromTx(connection, holder, oldest.signature);
      if (funder) {
        if (!funderMap[funder]) funderMap[funder] = [];
        funderMap[funder].push(holder);
      }
    } catch (e) {
      errors.push({ holder, error: e.message });
    }
  }

  // Only surface funders that funded 2+ of the checked top holders —
  // a single shared funding source across multiple top wallets is the
  // real, on-chain-provable insider/cluster signal.
  //
  // v1.10: a funder present in KNOWN_CEX_FUNDERS (lib/known-cex-funders.ts)
  // is excluded here even if it funded 2+ holders — shared exchange
  // deposit source, not shared insider control. The list starts empty
  // and is grown by hand (see that file's header); this filter is a
  // no-op until entries are added, which is intentional: excluding
  // nothing is the correct behavior for an address nobody has verified.
  const clusters = Object.entries(funderMap)
    .filter(([funder, holders]) => holders.length >= 2 && !KNOWN_CEX_FUNDERS.has(funder))
    .map(([funder, holders]) => ({ funder, holders }));

  return {
    checked: topHolders.length,
    clusters,
    clusterCount: clusters.length,
    unconfirmed: unconfirmed.length > 0 ? unconfirmed : undefined,
    errors,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ca = searchParams.get('ca');
    if (!ca) {
      return NextResponse.json({ error: 'ca param required' }, { status: 400, headers: RESPONSE_HEADERS });
    }

    // 1. Cache first. A hit costs nothing and is never rate limited.
    const cached = await readClusterCache(ca);

    if (cached) {
      return NextResponse.json(
        {
          checked: cached.checked,
          clusters: cached.clusters,
          clusterCount: cached.clusterCount,
          unconfirmed: cached.unconfirmed,
          cached: true,
        },
        { headers: RESPONSE_HEADERS },
      );
    }

    // 2. Cache miss — this one will cost RPC credits, so it needs budget.
    const allowance = await allowExpensiveClusterCheck(extractClientIp(request));
    if (!allowance.allowed) {
      // Explicit 429 with human text rather than an empty result. A blank
      // or fabricated "no clusters found" here would read as a clean bill
      // of health for a token nobody actually traced.
      return NextResponse.json(
        { error: allowance.message, rateLimited: true, scope: allowance.reason },
        { status: 429, headers: RESPONSE_HEADERS },
      );
    }

    // 3. Do the expensive work.
    const traced = await traceClusters(ca);

    if (traced.upstreamFailed) {
      return NextResponse.json(
        { error: 'Could not fetch holder data for this token' },
        { status: 502, headers: RESPONSE_HEADERS },
      );
    }

    if (traced.insufficient) {
      return NextResponse.json(
        { clusters: [], checked: traced.checked, note: 'Not enough holder data' },
        { headers: RESPONSE_HEADERS },
      );
    }

    // Only successful traces are cached. Caching an upstream failure
    // would pin the error in place for the full 12 hours.
    await writeClusterCache(ca, {
      checked: traced.checked,
      clusters: traced.clusters,
      clusterCount: traced.clusterCount,
      unconfirmed: traced.unconfirmed,
    });

    return NextResponse.json(
      {
        checked: traced.checked,
        clusters: traced.clusters,
        clusterCount: traced.clusterCount,
        unconfirmed: traced.unconfirmed,
        errors: traced.errors.length > 0 ? traced.errors : undefined,
        cached: false,
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
