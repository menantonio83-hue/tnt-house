// Version 1.0 — lib/demo-cta-clicks.ts
//
// Funnel step 2 of the public-demo-key experiment (see
// lib/demo-public-key-limit.ts for step 1 — the calls themselves).
// A demo response's get_your_own_key / x402 links point at
// app/api/demo-cta/route.ts instead of the raw destination URL
// directly, so a click-through (someone actually copying the link out
// of a JSON body/terminal and opening it) is countable at all — a
// bare URL string in a JSON field has zero attribution otherwise.
//
// Deliberately a separate table, not reusing api_request_log — a CTA
// click isn't an API call (no key/mint/status_code/response_time in
// the same sense), forcing it into that shape would be a worse fit
// than a dedicated one-purpose table.

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

const TABLE = 'demo_cta_clicks';

// Fire-and-forget, called via waitUntil() from the redirect route —
// never allowed to slow down or fail the actual redirect.
export async function logDemoCtaClick(target: string, identityHash: string | null): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({ target, identity_hash: identityHash });
  if (error) {
    console.error('[demo-cta-clicks] insert error:', error.message);
  }
}
