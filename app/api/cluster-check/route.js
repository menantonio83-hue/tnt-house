// app/api/cluster-check/route.js
// Version 1.7

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
import { createClient } from '@supabase/supabase-js';
import {
  readClusterCache,
  writeClusterCache,
  allowExpensiveClusterCheck,
  extractClientIp,
} from '@/lib/cluster-check-cache';

const supabase = createClient(
  'https://pjtvjslcffuulsqxerpx.supabase.co',
  'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU',
);

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';

// Safety caps so one request can't hammer the RPC forever on an old/busy wallet.
const MAX_HOLDERS_CHECKED = 10;
const MAX_SIG_PAGES = 3; // 3 * 1000 = up to 3000 signatures back per wallet
const SIG_PAGE_SIZE = 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Walk a wallet's signature history backwards (oldest last) to find its
// very first transaction signature.
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
    if (sigs.length < SIG_PAGE_SIZE) break; // reached the actual start of history
    before = oldest.signature;
  }
  return oldest ? oldest.signature : null;
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

  for (const holder of topHolders) {
    try {
      const pubkey = new PublicKey(holder);
      const oldestSig = await findOldestSignature(connection, pubkey);
      if (!oldestSig) continue;
      const funder = await findFunderFromTx(connection, holder, oldestSig);
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
  const clusters = Object.entries(funderMap)
    .filter(([, holders]) => holders.length >= 2)
    .map(([funder, holders]) => ({ funder, holders }));

  return {
    checked: topHolders.length,
    clusters,
    clusterCount: clusters.length,
    errors,
  };
}

// Persists a penalty score to `listed_tokens` (the table the live UI
// actually reads — confirmed via direct table inspection) when a real
// cluster is found.
//
// FIX v1.5: v1.4's "success: true" was a false positive. Supabase's
// update() does NOT return an error when Row Level Security silently
// filters the target row out of the UPDATE's visibility — it just
// updates 0 rows and reports success. That's exactly what was
// happening: SELECT worked (read policy exists), but UPDATE touched
// nothing (no write policy for this key/role), and the table kept
// showing the original score. Adding .select() after .update() forces
// Supabase to return the actual affected rows, so we can tell real
// success (rows.length > 0) apart from a silently blocked write
// (rows.length === 0, no error).
async function applyClusterScorePenalty(ca, clusterCount) {
  const scoreUpdate = { attempted: false };
  if (clusterCount <= 0) return scoreUpdate;

  scoreUpdate.attempted = true;

  const { data: existing, error: selectError } = await supabase
    .from('listed_tokens')
    .select('id, score')
    .eq('ca', ca)
    .maybeSingle();

  if (selectError) {
    scoreUpdate.selectError = selectError.message;
    console.error('[cluster-check] listed_tokens select failed:', selectError);
    return scoreUpdate;
  }
  if (!existing) {
    scoreUpdate.note = 'No matching row in listed_tokens for this ca';
    console.error('[cluster-check] no listed_tokens row for ca:', ca);
    return scoreUpdate;
  }
  if (existing.score <= 39) {
    scoreUpdate.note = 'Score already <= 39, no update needed';
    return scoreUpdate;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('listed_tokens')
    .update({ score: 39 })
    .eq('ca', ca)
    .select('id, score');

  if (updateError) {
    scoreUpdate.updateError = updateError.message;
    console.error('[cluster-check] listed_tokens update failed:', updateError);
  } else if (!updatedRows || updatedRows.length === 0) {
    // This is the RLS-silent-block case: no error, but nothing changed.
    scoreUpdate.blockedByRLS = true;
    scoreUpdate.note =
      'Update returned no error but affected 0 rows — likely blocked by a Row Level Security UPDATE policy on listed_tokens for this key/role.';
    console.error('[cluster-check] update affected 0 rows (likely RLS):', ca);
  } else {
    scoreUpdate.success = true;
    scoreUpdate.updatedRows = updatedRows;
  }

  return scoreUpdate;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ca = searchParams.get('ca');
    if (!ca) {
      return NextResponse.json({ error: 'ca param required' }, { status: 400, headers: CORS_HEADERS });
    }

    // 1. Cache first. A hit costs nothing and is never rate limited.
    const cached = await readClusterCache(ca);

    if (cached) {
      const scoreUpdate = await applyClusterScorePenalty(ca, cached.clusterCount);
      return NextResponse.json(
        {
          checked: cached.checked,
          clusters: cached.clusters,
          clusterCount: cached.clusterCount,
          cached: true,
          scoreUpdate,
        },
        { headers: CORS_HEADERS },
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
        { status: 429, headers: CORS_HEADERS },
      );
    }

    // 3. Do the expensive work.
    const traced = await traceClusters(ca);

    if (traced.upstreamFailed) {
      return NextResponse.json(
        { error: 'Could not fetch holder data for this token' },
        { status: 502, headers: CORS_HEADERS },
      );
    }

    if (traced.insufficient) {
      return NextResponse.json(
        { clusters: [], checked: traced.checked, note: 'Not enough holder data' },
        { headers: CORS_HEADERS },
      );
    }

    // Only successful traces are cached. Caching an upstream failure
    // would pin the error in place for the full 12 hours.
    await writeClusterCache(ca, {
      checked: traced.checked,
      clusters: traced.clusters,
      clusterCount: traced.clusterCount,
    });

    const scoreUpdate = await applyClusterScorePenalty(ca, traced.clusterCount);

    return NextResponse.json(
      {
        checked: traced.checked,
        clusters: traced.clusters,
        clusterCount: traced.clusterCount,
        errors: traced.errors.length > 0 ? traced.errors : undefined,
        cached: false,
        scoreUpdate,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}
