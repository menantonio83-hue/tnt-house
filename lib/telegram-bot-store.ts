// Version 1.0 — lib/telegram-bot-store.ts
//
// Storage layer for the "Insider Alerts" Telegram bot
// (app/api/telegram-bot/webhook/route.ts). Maps a Telegram chat/user id
// to a row in the EXISTING api_keys table, so the bot rides the same
// tier/quota/billing system as the HTTP API (lib/rate-limit.ts,
// lib/billing-pricing.ts) instead of a second, parallel one.
//
// REQUIRED table (already applied via Supabase migration for this
// project, kept here for reference / re-deploys elsewhere):
//
//   create table telegram_bot_links (
//     telegram_id bigint primary key,
//     api_key_id uuid not null references api_keys(id) on delete cascade,
//     linked_at timestamptz not null default now(),
//     last_check_at timestamptz
//   );
//   create index telegram_bot_links_api_key_id_idx on telegram_bot_links (api_key_id);

import { waitUntil } from '@vercel/functions';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { generateApiKey, isValidKeyFormat } from '@/lib/api-key';
import { insertApiKey, findApiKeyByRawKey, type ApiKeyRecord } from '@/lib/api-key-store';
import { todayUtcDateString } from '@/lib/rate-limit-store';

const LINKS_TABLE = 'telegram_bot_links';

async function loadKeyById(keyId: string): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('id', keyId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[telegram-bot-store] loadKeyById error:', error.message);
    return null;
  }
  return data as ApiKeyRecord | null;
}

/**
 * Returns the api_keys record linked to this Telegram user, auto-
 * provisioning a fresh free-tier key on first contact (owner_label
 * `tg:<telegram_id>`) so a brand-new user can run /check immediately —
 * no signup step, no email. Returns null only on an infra failure,
 * never as a normal "not found" case, since this always provisions one
 * if none exists yet.
 */
export async function getOrCreateLinkedKey(telegramId: number): Promise<ApiKeyRecord | null> {
  const { data: link, error: linkError } = await supabase
    .from(LINKS_TABLE)
    .select('api_key_id')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (linkError) {
    console.error('[telegram-bot-store] link lookup error:', linkError.message);
    return null;
  }

  if (link) {
    const existingKey = await loadKeyById(link.api_key_id);
    if (existingKey) return existingKey;
    // Linked key was deactivated/deleted server-side — fall through and
    // provision a fresh free key rather than leaving the user stuck.
  }

  const { keyHash, keyPrefix } = generateApiKey();
  const newKey = await insertApiKey(keyHash, keyPrefix, `tg:${telegramId}`, 'free');
  if (!newKey) return null;

  const { error: upsertError } = await supabase
    .from(LINKS_TABLE)
    .upsert({ telegram_id: telegramId, api_key_id: newKey.id, linked_at: new Date().toISOString() });

  if (upsertError) {
    console.error('[telegram-bot-store] link upsert error:', upsertError.message);
    // The key itself was created fine — return it anyway. Worst case,
    // the next /check re-provisions another free key for this user
    // instead of reusing this one, which just means a fresh 15/day
    // counter, not a broken bot.
  }

  return newKey;
}

/**
 * Attaches an existing Risk-Data API key (raw key, as issued by
 * /api/v1/signup or a subscription purchase) to this Telegram user.
 * Replaces any previous link — e.g. a user who started on an
 * auto-provisioned free key and then bought a subscription on the
 * website links their real key here to use its higher quota in the bot
 * too.
 */
// Flat interface with nullable fields, NOT a discriminated union on
// `ok` — same reason as ApiKeyAuthResult in lib/api-auth.ts: this
// repo's tsconfig has "strict": false, under which TS's narrowing on a
// boolean-literal discriminant is unreliable even for this exact
// textbook pattern (confirmed at compile time while writing this). A
// flat shape with nullable fields sidesteps the issue entirely.
export interface LinkKeyResult {
  ok: boolean;
  key: ApiKeyRecord | null;
  reason: 'malformed' | 'not_found' | null;
}

export async function linkExistingKey(telegramId: number, rawKey: string): Promise<LinkKeyResult> {
  if (!isValidKeyFormat(rawKey)) return { ok: false, key: null, reason: 'malformed' };

  const key = await findApiKeyByRawKey(rawKey);
  if (!key) return { ok: false, key: null, reason: 'not_found' };

  const { error } = await supabase
    .from(LINKS_TABLE)
    .upsert({ telegram_id: telegramId, api_key_id: key.id, linked_at: new Date().toISOString() });

  if (error) {
    console.error('[telegram-bot-store] linkExistingKey upsert error:', error.message);
  }

  return { ok: true, key, reason: null };
}

// Fire-and-forget — never awaited on the bot's reply path, same
// convention as touchApiKeyUsage in lib/api-auth.ts.
export function touchLastCheck(telegramId: number): void {
  waitUntil(
    supabase
      .from(LINKS_TABLE)
      .update({ last_check_at: new Date().toISOString() })
      .eq('telegram_id', telegramId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('[telegram-bot-store] touchLastCheck error:', error.message);
      }),
  );
}

/**
 * Today's free-tier usage count for a key, READ-ONLY — for the
 * /status command. Reads the same api_key_usage_daily table
 * lib/rate-limit.ts increments, but never writes to it, and reuses its
 * exact date-key convention (todayUtcDateString) so the two can never
 * drift onto different "today"s around UTC midnight.
 */
export async function peekTodayUsage(keyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('api_key_usage_daily')
    .select('request_count')
    .eq('key_id', keyId)
    .eq('usage_date', todayUtcDateString())
    .maybeSingle();

  if (error) {
    console.error('[telegram-bot-store] peekTodayUsage error:', error.message);
    return 0;
  }
  return data?.request_count ?? 0;
}
