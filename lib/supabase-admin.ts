// Version 6.1 — lib/supabase-admin.ts
//
// Server-only Supabase client for the Risk-Data API's own tables
// (api_keys, api_key_usage_daily, api_request_log, risk_cluster_cache).
//
// SECURITY FIX (Stage 6 final review): every other lib/*.ts file in this
// feature was using the same publishable/anon key already hardcoded in
// client-side bundles across the site (e.g. app/page.js). These four
// tables hold billing-relevant data — who has 'paid' tier, usage counts,
// which emails signed up. With RLS off (matching the existing site's
// pattern for tables like listed_tokens), that anon key had full
// read+write access via Supabase's public REST API — anyone could, for
// example, INSERT a row into api_keys with tier: 'paid' for a key hash
// they computed themselves, handing themselves unlimited free access
// and bypassing billing entirely.
//
// Fix: these four tables now have Row Level Security enabled with NO
// policies for anon/authenticated (default deny — see the migration
// applied directly via Supabase in this session). Our own server-side
// API routes instead authenticate with the SERVICE ROLE key, which
// bypasses RLS by design and never ships to the browser (only ever used
// from Next.js route handlers, which run server-side).
//
// REQUIRED env var (set in Vercel project settings — never commit this
// value to the repo):
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key from Supabase dashboard>
//   Found at: Project Settings -> API -> service_role ("secret") key
//
// Without this env var set, every Risk-Data API call will fail closed
// (401/500) rather than silently falling back to public access — that's
// intentional. Fixing it is just adding the env var; nothing else needs
// to change.
//
// IMPORTANT: @supabase/supabase-js's createClient() throws synchronously
// if given an empty-string key, which happens at MODULE LOAD TIME — and
// Next.js's build step imports every route to collect its metadata, so
// an empty key here would fail the entire `next build`, not just this
// route, taking the whole site's deploy down with it. A non-empty
// placeholder keeps the client constructible; real calls against it
// then fail normally at runtime (invalid API key), which every caller
// in this codebase already handles via try/catch + a logged error.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error(
    '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. Risk-Data API ' +
      'database access (auth, rate limits, caching, logging) will fail until ' +
      'it is configured in Vercel project settings.',
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  serviceRoleKey || 'missing-service-role-key-see-lib-supabase-admin-ts',
  { auth: { persistSession: false } },
);
