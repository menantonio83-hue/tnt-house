// Version 1.0 — lib/webhook-store.ts
//
// Supabase-backed storage for Risk-Data API webhook subscriptions. Uses
// supabaseAdmin (service role) — RLS is enabled on this table with no
// anon/authenticated policies, same pattern as api_keys /
// risk_cluster_cache (see lib/supabase-admin.ts).
//
// REQUIRED: create this table before deploying — see migration
// add_webhook_subscriptions_table (applied directly via Supabase in
// this session, not committed as a .sql file — same as how api_keys /
// risk_cluster_cache etc. were originally set up in this project):
//
//   create table webhook_subscriptions (
//     id uuid primary key default gen_random_uuid(),
//     api_key_id uuid not null references api_keys(id) on delete cascade,
//     mint text not null,
//     threshold smallint not null check (threshold between 0 and 100),
//     condition text not null check (condition in ('below','above')),
//     callback_url text not null,
//     webhook_secret text not null,
//     active boolean not null default true,
//     last_checked_score smallint,
//     last_triggered_at timestamptz,
//     created_at timestamptz not null default now()
//   );

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const TABLE = 'webhook_subscriptions';

export type WebhookCondition = 'below' | 'above';

export interface WebhookSubscription {
  id: string;
  api_key_id: string;
  mint: string;
  threshold: number;
  condition: WebhookCondition;
  callback_url: string;
  webhook_secret: string;
  active: boolean;
  last_checked_score: number | null;
  last_triggered_at: string | null;
  created_at: string;
}

// Public shape — everything EXCEPT webhook_secret, which is shown once
// at creation and never again (same convention as an API key's raw
// value), and api_key_id, which is internal bookkeeping.
export type PublicWebhookSubscription = Omit<WebhookSubscription, 'webhook_secret' | 'api_key_id'>;

function toPublic(row: WebhookSubscription): PublicWebhookSubscription {
  const { webhook_secret, api_key_id, ...rest } = row;
  return rest;
}

export async function countActiveSubscriptions(apiKeyId: string): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .eq('active', true);

  if (error) {
    console.error('[webhook-store] countActiveSubscriptions error:', error.message);
    return 0; // fail open on the count itself — the cap check errs toward allowing on an infra hiccup rather than hard-blocking every subscribe call
  }
  return count ?? 0;
}

export async function createSubscription(params: {
  apiKeyId: string;
  mint: string;
  threshold: number;
  condition: WebhookCondition;
  callbackUrl: string;
  webhookSecret: string;
}): Promise<WebhookSubscription | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      api_key_id: params.apiKeyId,
      mint: params.mint,
      threshold: params.threshold,
      condition: params.condition,
      callback_url: params.callbackUrl,
      webhook_secret: params.webhookSecret,
    })
    .select()
    .single();

  if (error) {
    console.error('[webhook-store] createSubscription error:', error.message);
    return null;
  }
  return data as WebhookSubscription;
}

export async function listSubscriptionsForKey(apiKeyId: string): Promise<PublicWebhookSubscription[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('api_key_id', apiKeyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[webhook-store] listSubscriptionsForKey error:', error.message);
    return [];
  }
  return (data as WebhookSubscription[]).map(toPublic);
}

export async function getSubscriptionById(id: string): Promise<WebhookSubscription | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) return null;
  return data as WebhookSubscription;
}

export async function deactivateSubscription(id: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).update({ active: false }).eq('id', id);
  if (error) {
    console.error('[webhook-store] deactivateSubscription error:', error.message);
    return false;
  }
  return true;
}

// Every ACTIVE subscription, for the cron sweep.
export async function listActiveSubscriptions(): Promise<WebhookSubscription[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('active', true);
  if (error) {
    console.error('[webhook-store] listActiveSubscriptions error:', error.message);
    return [];
  }
  return data as WebhookSubscription[];
}

// Called once per subscription per sweep, regardless of whether it
// triggered — last_checked_score is the baseline the NEXT sweep
// compares against to detect a crossing, so it has to move every time,
// not just on a trigger.
export async function updateAfterCheck(id: string, newScore: number, triggered: boolean): Promise<void> {
  const update: Record<string, unknown> = { last_checked_score: newScore };
  if (triggered) update.last_triggered_at = new Date().toISOString();

  const { error } = await supabase.from(TABLE).update(update).eq('id', id);
  if (error) {
    console.error('[webhook-store] updateAfterCheck error:', error.message);
  }
}
