// app/api/cluster-check/route.js
// Version 1.12
//
// FIX v1.12: this route used to carry its OWN copy of the first-funder
// trace (single-hop only: funderMap keyed by each holder's immediate
// funder, no hopping past fresh/thin intermediate wallets). That is why
// it diverged from the Risk-Data API's lib/insider-cluster-detector.ts
// (v7.x), which hops up to 3 levels past thin/fresh wallets before
// accepting a funder as final — confirmed on a real token (UNTIE):
// this route reported "no shared funding source" while the API found a
// 2-wallet cluster whose shared funder only appears 2 hops up. Both the
// free Quick Check AND the paid audit call this same route (see
// app/page.js — checkClusters() and the paid post-payment flow both
// fetch /api/cluster-check), so a paying user was getting the WEAKER of
// the two detectors this project has, not the stronger one.
//
// This route now calls detectInsiderClusters() from
// lib/insider-cluster-detector.ts — the exact same engine the paid API
// uses — instead of its own duplicate logic. The local
// findOldestSignature / findFunderFromTx / traceClusters functions,
// and the direct KNOWN_CEX_FUNDERS filtering they did inline, are
// removed: the shared module already does deeper tracing AND its own
// CEX/infra classification (allowlist + composite heuristic — stronger
// than this route's allowlist-only check). This route keeps only what
// is genuinely its own concern: the 12h result cache and the
// public-traffic rate limit that protect the site's Helius quota (the
// Risk-Data API has its own, separate key-based limits and does not
// need either).
//
// One known gap from this swap, noted rather than hidden: the old
// per-holder `unconfirmed` list (wallets whose signature history was
// too deep to confirm their true first transaction) doesn't have a
// direct equivalent in the shared module's output — a holder whose
// trace fails there surfaces in `errors`, but "trace failed" and
// "trace succeeded but found no funding tx" aren't distinguished the
// same way. `unconfirmed` is left out of this route's response rather
// than filled in with a guess.
//
// FIX v1.11: KNOWN_CEX_FUNDERS is now a Record<string, string> (v2.0 of
// that file) — same addresses, now with labels. (Superseded by v1.12:
// this route no longer reads that file directly — the shared module
// does.)
//
// FIX v1.10: funders present in lib/known-cex-funders.ts were excluded
// from cluster matching. No live free API for Solana CEX wallet labels
// exists (checked Helius Wallet Identity — paid only; checked Vybe
// Network labeled-accounts — also paid-tier only despite Vybe having a
// free plan), so that file starts empty and is grown by hand, address
// by verified address. (Superseded by v1.12: this filtering now
// happens inside lib/insider-cluster-detector.ts's classifyFunder,
// which is stricter — allowlist first, then a composite heuristic for
// unlisted infra wallets — rather than allowlist-only.)
//
// FIX v1.9: findOldestSignature used to return whatever signature it
// saw oldest within its page budget and treat that as a confirmed
// first transaction, misreading busy/CEX wallets. (Superseded by
// v1.12: this route no longer walks signature history itself.)
//
// FIX v1.8: this route used to end every trace by forcibly setting
// listed_tokens.score to a flat 39 whenever clusterCount > 0. That
// write ran on both fresh traces and cache hits, permanently pinning
// the number regardless of what lib/scoring.ts had actually computed.
// This route no longer writes to listed_tokens.score at all — it only
// traces and reports clusters.
//
// FIX v1.6: this endpoint walks holder signature history over RPC —
// genuinely slow — and runs automatically on every audit submission.
// maxDuration explicitly raised so it has real headroom under
// Vercel's serverless timeout.
export const maxDuration = 60;

// First Funder Trace: for a token's top holders, find whether multiple
// of them are ultimately funded by the same wallet — a real,
// on-chain-provable insider/sniper cluster signal. The actual tracing
// (including hopping past fresh intermediate wallets and classifying
// the final funder) lives in lib/insider-cluster-detector.ts, shared
// with the Risk-Data API. This route is a thin wrapper: cache, rate
// limit, call the shared engine, shape the response for app/page.js.
//
// FIX v1.7 (kept): this route had no auth, no rate limit and no cache,
// while a single GET could fan out to dozens of upstream calls. Now:
//
//   1. Results are cached for 12h per mint (lib/cluster-check-cache.ts).
//      A first funder is a historical fact and does not change; only
//      the top-holder set drifts, slowly. Cache hits cost zero RPC.
//   2. The rate limit applies ONLY to cache misses — the requests that
//      actually spend credits. 10/hour and 20/day per IP, 200/day
//      global.
//   3. Hitting the limit returns 429 with a human-readable `error`
//      string, which app/page.js already renders. No silent
//      degradation: the user is told the tracer is paused, never shown
//      an empty or fake "no clusters found" result.

import { NextResponse } from 'next/server';
import {
  readClusterCache,
  writeClusterCache,
  allowExpensiveClusterCheck,
  extractClientIp,
} from '@/lib/cluster-check-cache';
import { detectInsiderClusters } from '@/lib/insider-cluster-detector';

// CORS v1.1 (kept): this route no longer advertises
// Access-Control-Allow-Origin. It is the insider-cluster trace, called
// from our own pages, same-origin, and it identifies the caller by IP
// or browser fingerprint rather than by a key. A wildcard let any other
// website make ITS visitors spend this quota, with the cost landing on
// the visitor's identity instead of the attacker's.
const RESPONSE_HEADERS = {};

// Runs the shared detector and reshapes its output for this route's
// existing response contract (app/page.js reads checked / clusters /
// clusterCount / unconfirmed).
//
// v1.12: clusterCount and the returned `clusters` array both exclude
// funders classified as false_positive_likely (CEX/known-infra hot
// wallets and the composite infra heuristic) — matching what this
// route always meant by "cluster": shared insider control, not shared
// exchange plumbing. Each surfaced cluster still carries funder_class /
// funder_label / funder_confidence so a future UI change can show WHY
// a funder was or wasn't counted, without another RPC round trip.
async function traceClusters(ca) {
  let result;
  try {
    result = await detectInsiderClusters(ca);
  } catch (e) {
    // detectInsiderClusters throws when RugCheck's upstream holder data
    // couldn't be fetched at all — the one failure mode that must not
    // be cached (see the caller).
    return { upstreamFailed: true, message: e.message };
  }

  if (result.checkedHolders < 2) {
    return { insufficient: true, checked: result.checkedHolders };
  }

  const realClusters = result.clusters.filter((c) => !c.false_positive_likely);

  return {
    checked: result.checkedHolders,
    clusters: realClusters.map((c) => ({
      funder: c.funder,
      holders: c.wallets,
      funder_class: c.funder_class,
      funder_label: c.funder_label,
      funder_confidence: c.funder_confidence,
    })),
    clusterCount: realClusters.length,
    errors: result.errors.length > 0 ? result.errors : undefined,
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

    // 3. Do the expensive work — via the shared 3-hop engine.
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
        errors: traced.errors,
        cached: false,
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
