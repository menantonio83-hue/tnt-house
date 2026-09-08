// Version 1.1 — lib/listed-token-envelope.ts
//
// Signs and verifies the audit payloads that /api/listed-tokens/audit
// produces and /api/listed-tokens/save consumes.
//
// WHY A SIGNATURE AND NOT AN API KEY: there is no user account system on
// the consumer site, so there is nobody to authenticate. Any token handed
// to the browser is equally available to anyone else who loads the page.
// A permission check therefore cannot work here.
//
// What CAN work is removing the caller's ability to assert anything. The
// server computes the audit, signs the result, and the save route accepts
// only what carries a valid signature. An attacker can still ask for an
// envelope for any mint they like — but only ever with the honest numbers
// the server itself calculated. The signature is an attestation of
// content, not a grant of access.
//
// Three properties, in order of importance:
//   1. Integrity  - the payload cannot be edited after signing. Changing
//                   one digit of `score` invalidates the whole envelope.
//   2. Freshness  - envelopes expire, so one cannot be replayed weeks
//                   later against changed market conditions.
//   3. Single use - a nonce the save route burns in Redis, so the same
//                   envelope cannot be submitted twice.
// This module owns 1 and 2. The nonce is generated here; burning it is
// the save route's job, since only that route knows a write succeeded.
//
// Keys are compared with timingSafeEqual rather than ===, so a signature
// cannot be recovered a byte at a time by measuring response times.

import crypto from 'crypto';

const ENVELOPE_TTL_SECONDS = 5 * 60;

// Bumped if the signed structure changes, so an envelope minted by an
// older deploy is rejected outright instead of being half-understood.
const ENVELOPE_VERSION = 1;

export interface SignedEnvelope<T> {
  v: number;
  payload: T;
  is_free: boolean;
  exp: number; // unix seconds
  nonce: string;
  sig: string;
}

export interface VerifyResult<T> {
  valid: boolean;
  reason: string | null;
  payload: T | null;
  is_free: boolean;
  nonce: string | null;
}

function getSecret(): string | null {
  const secret = process.env.LISTED_TOKEN_SIGNING_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

// Deterministic serialisation. JSON.stringify does not guarantee key
// order for objects built along different code paths, and a signature
// over a non-canonical encoding would fail verification for payloads that
// are actually identical. Keys are sorted recursively; arrays keep their
// order, which is meaningful.
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k]));
  return '{' + entries.join(',') + '}';
}

function computeSignature(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Wrap a server-computed payload in a signed, expiring envelope.
 * Returns null when the signing secret is missing or too short — the
 * caller must treat that as a hard failure, never as "sign it anyway".
 */
export function signEnvelope<T>(payload: T, isFree: boolean): SignedEnvelope<T> | null {
  const secret = getSecret();
  if (!secret) {
    console.error(
      '[listed-token-envelope] LISTED_TOKEN_SIGNING_SECRET is missing or shorter than 32 chars',
    );
    return null;
  }

  const exp = Math.floor(Date.now() / 1000) + ENVELOPE_TTL_SECONDS;
  const nonce = crypto.randomBytes(16).toString('hex');

  // is_free is inside the signed body on purpose. It is a server decision
  // backed by an already-consumed slot from claim_free_listing_slot(); if
  // it travelled outside the signature the caller could flip it and take
  // a free listing without one.
  const body = canonical({ v: ENVELOPE_VERSION, payload, is_free: isFree, exp, nonce });

  return {
    v: ENVELOPE_VERSION,
    payload,
    is_free: isFree,
    exp,
    nonce,
    sig: computeSignature(secret, body),
  };
}

/**
 * Verify an envelope received from a client. Never throws.
 */
export function verifyEnvelope<T>(input: unknown): VerifyResult<T> {
  const fail = (reason: string): VerifyResult<T> => ({
    valid: false,
    reason,
    payload: null,
    is_free: false,
    nonce: null,
  });

  const secret = getSecret();
  if (!secret) return fail('signing secret not configured');

  if (!input || typeof input !== 'object') return fail('envelope is not an object');
  const env = input as Partial<SignedEnvelope<T>>;

  if (env.v !== ENVELOPE_VERSION) return fail('unsupported envelope version');
  if (typeof env.sig !== 'string' || env.sig.length !== 64) return fail('malformed signature');
  if (typeof env.nonce !== 'string' || env.nonce.length !== 32) return fail('malformed nonce');
  if (typeof env.exp !== 'number' || !Number.isFinite(env.exp)) return fail('malformed expiry');
  if (typeof env.is_free !== 'boolean') return fail('malformed is_free');
  if (env.payload === undefined || env.payload === null) return fail('missing payload');

  // Signature is checked BEFORE expiry: until the signature is known good,
  // every other field is attacker-controlled and not worth reasoning about.
  const body = canonical({
    v: env.v,
    payload: env.payload,
    is_free: env.is_free,
    exp: env.exp,
    nonce: env.nonce,
  });
  const expected = computeSignature(secret, body);

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(env.sig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return fail('signature mismatch');
  }

  if (Math.floor(Date.now() / 1000) > env.exp) return fail('envelope expired');

  return {
    valid: true,
    reason: null,
    payload: env.payload as T,
    is_free: env.is_free,
    nonce: env.nonce,
  };
}
