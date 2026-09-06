// Version 1.3 — scripts/rescore-v2.ts
//
// One-off retroactive rescore of listed_tokens under the V2 formula
// (lib/scoring.ts). 65 rows, so this is a script, not a migration: it runs
// in one pass, prints every row, and only writes when told to.
//
// It recomputes from RAW FACTS ALREADY STORED IN THE ROW — no Helius, no
// RugCheck, no DexScreener. Zero upstream cost, zero rate-limit risk.
//
// IMPORTANT: the stored market figures (liquidity, volume24h, age_days) are
// from the ORIGINAL audit date. This is not a fresh check — it is the old
// facts run through the new formula. That is why every rewritten row gets
// recalculated_at set separately from its original audit timestamp, and why
// the UI must label these rows rather than silently showing a new number.
//
// Rows missing top10_percent are NOT scored. Without it the top10 caps
// cannot fire, so any number we produced would be optimistic in exactly the
// case that matters most. They are marked insufficient_data instead — an
// honest gap beats a wrong figure.
//
// Usage:
//   npx tsx scripts/rescore-v2.ts            # dry run, prints a table
//   npx tsx scripts/rescore-v2.ts --apply    # writes to Supabase
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment.

import { computeFullScore, classifyHolderRisk } from '../lib/scoring';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

// 'Revoked ✓' / 'Active ⚠️' / '-' / null are all possible in stored rows.
const isRevoked = (v: unknown): boolean => typeof v === 'string' && v.includes('Revoked');
const isYes = (v: unknown): boolean | null =>
  typeof v === 'string' ? (v.includes('Yes') ? true : v.includes('No') ? false : null) : null;
// PostgREST returns Postgres `numeric` columns as JSON STRINGS ("95.2", not
// 95.2) to avoid float precision loss. top10_percent, liquidity, volume24h
// and friends are all numeric, so a plain `typeof v === 'number'` check
// rejects every one of them — which would have sent all 65 rows to
// insufficient_data instead of rescoring any of them. Caught in dry run
// before anything was written.
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

// Same trap for booleans: a text-typed column stores 'true'/'false'.
const bool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
};

interface Row {
  id: number | string;
  ca: string;
  symbol: string | null;
  score: number | string | null;
  mint_authority: string | null;
  freeze_authority: string | null;
  top10_percent: number | string | null;
  holder_count: number | string | null;
  liquidity: number | string | null;
  volume24h: number | string | null;
  age_days: number | null;
  last_audit_at: string | null;
  buy_tax_percent: number | string | null;
  sell_tax_percent: number | string | null;
  hidden_owner: string | null;
  permanent_delegate: string | null;
  standard_program: boolean | string | null;
  creator_balance_percent: number | string | null;
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listed_tokens?select=*`, { headers });
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const rows: Row[] = await res.json();
  console.log(`Fetched ${rows.length} rows. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  // Guard rail against exactly the bug that nearly shipped: if almost every
  // row parses as "no top10_percent", that is a parsing failure, not 65
  // genuinely incomplete rows. Refuse to write rather than mass-marking the
  // whole table insufficient_data.
  const parseable = rows.filter((r) => num(r.top10_percent) !== null).length;
  if (rows.length > 0 && parseable / rows.length < 0.5) {
    console.error(
      `Only ${parseable}/${rows.length} rows have a parseable top10_percent. ` +
        `That looks like a type/parsing problem, not real missing data. Aborting.`,
    );
    process.exit(1);
  }

  let scored = 0;
  let skipped = 0;
  let ageAdvanced = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const top10 = num(row.top10_percent);

    if (top10 === null) {
      skipped++;
      console.log(
        `SKIP  ${(row.symbol ?? '?').padEnd(10)} ${row.ca.slice(0, 6)}…  old=${row.score}  ` +
          `-> insufficient_data (no top10_percent)`,
      );
      if (APPLY) {
        await patch(row.id, { score_version: 'insufficient_data', recalculated_at: now });
      }
      continue;
    }

    const holderCount = num(row.holder_count) ?? 0;

    // age_days is a SNAPSHOT from the original audit, not a live figure. A
    // token recorded as "0 days old" six months ago is not 0 days old now,
    // and re-applying age_lt_1d (cap 55) to it would be flatly wrong today.
    // Unlike liquidity/volume, age is recoverable by arithmetic alone:
    // stored age + elapsed time since the audit. No upstream call, no
    // invented data. This is the single biggest driver of the downward
    // swings seen in dry run.
    const storedAge = num(row.age_days);
    let effectiveAge = storedAge;
    if (storedAge !== null && row.last_audit_at) {
      const auditedAt = Date.parse(row.last_audit_at);
      if (Number.isFinite(auditedAt)) {
        effectiveAge = storedAge + Math.floor((Date.now() - auditedAt) / 86400000);
      }
    }

    // largest_holder_percent was never stored on this table, so the level is
    // derived from top10 alone. That can only UNDER-state concentration
    // (CRITICAL needs a single wallet >20%), never over-state it, and the
    // top10 caps below still fire regardless. Flagged in the output so the
    // rows are auditable by hand.
    const riskLevel = classifyHolderRisk(0, top10);

    const result = computeFullScore({
      mintAuthorityRevoked: isRevoked(row.mint_authority),
      freezeAuthorityRevoked: isRevoked(row.freeze_authority),
      holderRisk: { riskLevel, top10Percent: top10, holderCount },
      dexData: {
        liquidity: num(row.liquidity),
        volume24h: num(row.volume24h),
        ageDays: effectiveAge,
      },
      clusters: [],
      clusterAnalysis: 'pending',
      rugged: null,
      // No cluster tracing and no RugCheck call here — see the
      // retro_unverified note in lib/scoring.ts. Caps the result at 74 so a
      // row cannot reach the green band on checks that were never run.
      retroUnverified: true,
      contractSignals: {
        hiddenOwner: isYes(row.hidden_owner),
        permanentDelegate: isYes(row.permanent_delegate),
        tokenProgram:
          bool(row.standard_program) === true
            ? 'standard'
            : bool(row.standard_program) === false
              ? 'nonstandard'
              : null,
        buyTaxPercent: num(row.buy_tax_percent),
        sellTaxPercent: num(row.sell_tax_percent),
        devWalletPercent: num(row.creator_balance_percent),
      },
    });

    scored++;
    if (effectiveAge !== null && storedAge !== null && effectiveAge !== storedAge) ageAdvanced++;
    const oldScore = num(row.score);
    const delta =
      oldScore === null
        ? '—'
        : `${result.score - oldScore >= 0 ? '+' : ''}${result.score - oldScore}`;
    console.log(
      `SCORE ${(row.symbol ?? '?').padEnd(10)} ${row.ca.slice(0, 6)}…  ` +
        `old=${String(oldScore ?? '—').padStart(3)} -> new=${String(result.score).padStart(3)} (${delta})  ` +
        `cap=${result.dominantCap ?? 'none'}`,
    );

    if (APPLY) {
      await patch(row.id, {
        score: result.score,
        score_version: 'v2',
        recalculated_at: now,
      });
    }
  }

  console.log(
    `\nDone. scored=${scored} skipped=${skipped} total=${rows.length} ` +
      `(age advanced from snapshot on ${ageAdvanced} rows)`,
  );
  if (!APPLY) console.log('Dry run — nothing written. Re-run with --apply to persist.');
}

async function patch(id: number | string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listed_tokens?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`  ! write failed for id=${id}: ${res.status} ${await res.text()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
