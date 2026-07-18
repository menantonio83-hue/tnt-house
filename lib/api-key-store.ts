// Version 6.3 — lib/api-key-store.ts
//
// v6.3: switched to the service-role Supabase client (lib/supabase-admin.ts).
// This is the most important table to have locked down — it's what
// decides who gets 'paid' (unlimited) access. See lib/supabase-admin.ts.
//
// Supabase-backed storage for Risk-Data API keys.
//
// REQUIRED: create this table in Supabase before deploying Stage 2:
//
//   create table api_keys (
//     id uuid primary key default gen_random_uuid(),
//     key_hash text not null unique,      -- sha256(rawKey), raw key is NEVER stored
//     key_prefix text not null,           -- display-only, e.g. "tnt_sk_a1b2c3d"
//     owner_label text,                   -- free-text for now (email/project name);
//                                          -- becomes a real user_id once Stage 5 ships auth
//     tier text not null default 'free',  -- 'free' | 'paid' — enforced in Stage 3
//     is_active boolean not null default true,
//     created_at timestamptz not null default now(),
//     last_used_at timestamptz,
//     request_count bigint not null default 0
//   );
//   create index api_keys_key_hash_idx on api_keys (key_hash);
//
// Note: full per-request usage LOGGING (which mint, when, by whom) is
// Stage 4 scope. This module only tracks enough to know a key is alive
// (last_used_at, a running request_count) — not a substitute for the
// Stage 4 audit log.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const TABLE = 'api_keys';

export type ApiKeyTier = 'free' | 'paid';

export interface ApiKeyRecord {
  id: string;
  key_hash: string;
  key_prefix: string;
  owner_label: string | null;
  tier: ApiKeyTier;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
}

export async function insertApiKey(
  keyHash: string,
  keyPrefix: string,
  ownerLabel: string,
  tier: ApiKeyTier = 'free',
): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ key_hash: keyHash, key_prefix: keyPrefix, owner_label: ownerLabel, tier })
    .select()
    .single();

  if (error) {
    console.error('[api-key-store] insert error:', error.message);
    return null;
  }
  return data as ApiKeyRecord;
}

export async function findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[api-key-store] lookup error:', error.message);
    return null;
  }
  return data as ApiKeyRecord | null;
}

// Fire-and-forget usage stamp — called via waitUntil() from the auth
// check, never awaited on the request's critical path.
export async function touchApiKeyUsage(id: string, previousCount: number): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ last_used_at: new Date().toISOString(), request_count: previousCount + 1 })
    .eq('id', id);

  if (error) console.error('[api-key-store] touch usage error:', error.message);
}
