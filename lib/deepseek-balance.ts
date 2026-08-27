// Version 1.0 — lib/deepseek-balance.ts
//
// Low-balance alert for the DeepSeek account both chat widgets now run
// on (see app/api/chat/route.js and app/api/risk-api-chat/route.ts,
// migrated from Groq 2026-08-27). Product owner uses this same
// DeepSeek account for personal manual use too (a separate Chatbox
// app on their phone), so the balance can drain faster than chat-
// widget traffic alone would suggest — worth a heads-up before it
// silently hits zero and both widgets start failing with no warning,
// the same way the Groq deprecation went unnoticed for 11 days.
//
// Piggybacks on existing chat traffic rather than a new cron job: no
// QStash schedule to configure (QSTASH_TOKEN isn't even confirmed set
// in this project — see lib/qstash-publish.ts's own warning), no new
// infra. checkDeepSeekBalanceIfDue() is called (fire-and-forget, never
// awaited by the caller) from both chat routes after a successful
// reply; a cooldown means the actual DeepSeek balance API call only
// happens once every CHECK_COOLDOWN_MS, regardless of chat volume.
//
// Reuses the external_service_alerts table (same one alertAdmin() uses
// for its own per-service alert cooldown) as a generic "when did we
// last do X for this service_name" tracker — 'deepseek-balance-check'
// here is a distinct key from any alert-cooldown key, so the two
// purposes don't collide.

import { supabaseAdmin } from './supabase-admin';
import { alertAdmin } from './telegram-alert';

const CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours between actual balance API calls
const LOW_BALANCE_THRESHOLD_USD = 1.0;
const CHECK_KEY = 'deepseek-balance-check';

export async function checkDeepSeekBalanceIfDue(): Promise<void> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return; // nothing to check without a key

    const { data: existing, error: readError } = await supabaseAdmin
      .from('external_service_alerts')
      .select('last_alerted_at')
      .eq('service_name', CHECK_KEY)
      .maybeSingle();

    if (readError) {
      console.error('[deepseek-balance] cooldown lookup failed:', readError.message);
      return; // fail closed here — a skipped balance check is low-stakes, unlike a skipped failure alert
    }

    if (existing) {
      const lastCheckedMs = new Date(existing.last_alerted_at).getTime();
      if (Date.now() - lastCheckedMs < CHECK_COOLDOWN_MS) return; // still within cooldown
    }

    // Mark the check as done BEFORE the network call so a slow/failing
    // balance API call can't cause a burst of concurrent requests to
    // all pile in during the same cooldown window.
    await supabaseAdmin
      .from('external_service_alerts')
      .upsert({ service_name: CHECK_KEY, last_alerted_at: new Date().toISOString() });

    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + apiKey },
    });

    if (!res.ok) {
      console.error('[deepseek-balance] balance check failed:', res.status);
      return; // not itself alert-worthy — a transient failure to check isn't the same as a low balance
    }

    const data = await res.json();
    const usdEntry = Array.isArray(data.balance_infos)
      ? data.balance_infos.find((b: any) => b.currency === 'USD')
      : null;

    if (!usdEntry) return; // no USD balance line — nothing to compare against the threshold

    const totalBalance = parseFloat(usdEntry.total_balance);
    if (!Number.isFinite(totalBalance)) return;

    if (totalBalance < LOW_BALANCE_THRESHOLD_USD) {
      // alertAdmin has its own separate per-service cooldown (1 hour,
      // under service_name 'deepseek-low-balance') — distinct from this
      // file's 6-hour check-frequency cooldown above.
      await alertAdmin(
        'deepseek-low-balance',
        `DeepSeek balance is $${totalBalance.toFixed(2)} — below the $${LOW_BALANCE_THRESHOLD_USD.toFixed(2)} alert threshold. Both chat widgets run on this account.`,
      );
    }
  } catch (err) {
    console.error('[deepseek-balance] unexpected error:', err instanceof Error ? err.message : err);
  }
}
