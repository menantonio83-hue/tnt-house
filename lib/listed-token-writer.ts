// Version 1.1 — lib/listed-token-writer.ts
//
// The single place a listed_tokens row is written.
//
// Extracted from app/api/listed-tokens/save/route.ts so the paid path can
// use the same writer without going through an envelope. The envelope
// exists to stop the BROWSER asserting facts; when the caller is our own
// server code, there is nothing to attest and signing a payload to
// immediately verify it ourselves would be ceremony, not safety. Both
// callers must still share one writer, because the two rules below are
// easy to get subtly different in two copies, and both have already bitten
// this project once.

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ListedTokenRow } from '@/lib/listed-token-projection';

export interface WriteOutcome {
  ok: boolean;
  action: 'inserted' | 'updated' | null;
  error: string | null;
}

/**
 * Insert or update the row for this mint.
 *
 * RULE 1 — is_free is written on INSERT only, never on UPDATE. A re-audit
 * of an already-listed token takes the 'existing_listing' branch in
 * claim_free_listing_slot and so legitimately reports is_free false;
 * writing that on update would flip a previously free-listed token to
 * not-free and desynchronise listed_tokens from the claim ledger. That is
 * not hypothetical — that drift is what fired the free-slot mismatch alert.
 *
 * RULE 2 — a write that changes zero rows is a failure, not a success.
 * Supabase reports no error when an UPDATE matches nothing, which is
 * exactly how the RLS-blocked cluster-check writes went unnoticed for
 * weeks.
 *
 * last_audit_at is stamped here rather than by the caller: it is what the
 * site sorts "Newest" by, so it must mean "when this row was stored".
 */
export async function writeListedTokenRow(
  row: ListedTokenRow,
  isFree: boolean,
): Promise<WriteOutcome> {
  const stamped = { ...row, last_audit_at: new Date().toISOString() };

  const existing = await supabaseAdmin
    .from('listed_tokens')
    .select('id')
    .eq('ca', row.ca)
    .limit(1);

  if (existing.error) {
    return { ok: false, action: null, error: `lookup failed: ${existing.error.message}` };
  }

  const alreadyListed = Array.isArray(existing.data) && existing.data.length > 0;

  if (alreadyListed) {
    const { is_free: _ignored, ...updatable } = stamped as typeof stamped & { is_free?: boolean };

    const updated = await supabaseAdmin
      .from('listed_tokens')
      .update(updatable)
      .eq('ca', row.ca)
      .select('id');

    if (updated.error) {
      return { ok: false, action: null, error: `update failed: ${updated.error.message}` };
    }
    if (!updated.data || updated.data.length === 0) {
      return { ok: false, action: null, error: 'update matched no rows' };
    }
    return { ok: true, action: 'updated', error: null };
  }

  const inserted = await supabaseAdmin
    .from('listed_tokens')
    .insert({ ...stamped, is_free: isFree })
    .select('id');

  if (inserted.error) {
    return { ok: false, action: null, error: `insert failed: ${inserted.error.message}` };
  }
  if (!inserted.data || inserted.data.length === 0) {
    return { ok: false, action: null, error: 'insert returned no row' };
  }
  return { ok: true, action: 'inserted', error: null };
}
