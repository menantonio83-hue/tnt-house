// Version 2.1 — lib/api-key.ts
//
// Pure API-key utilities: generation, hashing, format validation.
// No Supabase calls here on purpose — this stays testable and reusable
// by both the admin key-issuing endpoint and the auth check.
//
// Raw keys look like: tnt_sk_<48 hex chars>
// Only the SHA-256 hash of a key is ever stored in the database. The raw
// key is returned to the caller exactly once, at generation time.

import crypto from 'crypto';

const KEY_PREFIX = 'tnt_sk_';
const RANDOM_BYTES = 24; // -> 48 hex chars
const KEY_FORMAT_REGEX = /^tnt_sk_[a-f0-9]{48}$/;

export interface GeneratedApiKey {
  rawKey: string;
  keyHash: string;
  keyPrefix: string; // safe to store/display — not enough to reconstruct the key
}

export function generateApiKey(): GeneratedApiKey {
  const randomPart = crypto.randomBytes(RANDOM_BYTES).toString('hex');
  const rawKey = `${KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(rawKey);
  // First 14 chars (prefix + 7 hex chars) — enough to recognize a key in a
  // dashboard/logs without exposing anything usable to authenticate.
  const keyPrefix = rawKey.slice(0, 14);

  return { rawKey, keyHash, keyPrefix };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function isValidKeyFormat(rawKey: string): boolean {
  return KEY_FORMAT_REGEX.test(rawKey);
}
