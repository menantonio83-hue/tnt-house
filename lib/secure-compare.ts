// Version 1.0 — lib/secure-compare.ts
//
// Constant-time string comparison for admin/shared secrets. `===` on
// secrets is a timing side channel: it stops at the first differing
// character, so an attacker who can measure response latency can probe
// a secret one byte at a time. timingSafeEqual takes the same time
// regardless of how many leading bytes match.
//
// Returns false (never throws) when either operand is missing or not a
// string — callers keep their existing `!expectedSecret ||` fail-closed
// check for the unset-env case, this just hardens the comparison
// itself.

import crypto from 'crypto';

export function secureCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const aBytes = Buffer.from(a, 'utf-8');
  const bBytes = Buffer.from(b, 'utf-8');

  // Length differs -> not equal. This one length check is unavoidable
  // without padding, and leaks only the secret's LENGTH (which an
  // attacker usually already knows from the env-var docs), not its
  // contents.
  if (aBytes.length !== bBytes.length) return false;

  return crypto.timingSafeEqual(aBytes, bBytes);
}
