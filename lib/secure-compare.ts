// Version 1.1 — lib/secure-compare.ts
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
//
// FIX v1.1: build broke on Vercel — "Type 'Buffer' is not assignable to
// type 'Uint8Array<ArrayBufferLike> | DataView<ArrayBufferLike>'" at
// the timingSafeEqual call. Root cause: pnpm-lock.yaml resolves TWO
// different @types/node versions (12.20.55 and 26.4.0) for different
// dependencies in this project, and with no @types/node entry pinned
// in package.json, which one wins a given compile is not guaranteed —
// esbuild's syntax-only check (used to verify this file before it was
// committed) doesn't run the type-checker at all, so this shipped
// unnoticed until Vercel's real `next build` hit it. Same root cause
// as the ArrayBufferView ambiguity documented in lib/chat-limit.ts's
// v1.1 header for Web Crypto; fixed the same way here — wrap in a
// genuine Uint8Array (not a Buffer) right before the call. A plain
// Uint8Array satisfies every version of the ArrayBufferView type this
// project might resolve, so this is safe regardless of which
// @types/node the lockfile picks for a given build.

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

  return crypto.timingSafeEqual(new Uint8Array(aBytes), new Uint8Array(bBytes));
}
