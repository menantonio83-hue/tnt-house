// Version 5.8 — app/risk-api/page.tsx
//
// v5.8: added openGraph/twitter metadata (og:title, og:description,
// og:image) so links shared on X/Telegram/HN/Product Hunt render a
// proper card instead of a bare URL. Reuses the same shield image as
// the root layout — see app/layout.js v (OG fix) for the sibling
// change on the homepage.
//
// v5.7: fetches a real, honest count of total requests served
// (api_request_log row count) server-side and passes it to
// RiskApiPageContent as a trust-signal stat line under the hero
// ("X risk checks performed"). Falls back to null (renders no stat
// line at all, rather than a fake number) if the query fails — see
// lib/supabase-admin.ts for why SUPABASE_SERVICE_ROLE_KEY might be
// unset in some environments. Per product-owner decision 2026-08-27:
// real number, however modest, never a placeholder/rounded-up figure.
//
// Version 5.6 — app/risk-api/page.tsx
//
// v5.6: split into a thin server wrapper (keeps `export const metadata`
// working — that only works in server components) + LangProvider +
// RiskApiPageContent (new, client component with the actual page body
// and all the multi-language logic). Same visual output as before,
// now wired for the 7-language switcher (see i18n.ts / LangContext.tsx),
// same architecture as app/page.js's own language handling.
//
// v5.5: added the Billing section (id="billing", matches the
// upgrade_url anchor from lib/rate-limit.ts v3.4) with the interactive
// BillingPanel, and updated Pricing from the old free/paid placeholder
// to the real three-tier model (free / pay-per-call / subscription).
//
// Public landing + docs page for the Risk-Data API at /risk-api.
// New route, doesn't touch app/page.js or any existing page. Visual
// language deliberately matches the rest of TNT House exactly (purple →
// emerald gradient on black, font-mono, glowing terminal panels) rather
// than inventing a new direction — this is a feature of the same
// product, not a separate brand.

import type { Metadata } from 'next';
import { LangProvider } from './LangContext';
import RiskApiPageContent from './RiskApiPageContent';
import { supabaseAdmin } from '../../lib/supabase-admin';

export const metadata: Metadata = {
  title: 'Risk-Data API — TNT House',
  description:
    'Insider-cluster detection and Solana token risk scoring as a JSON API, built for AI trading agents.',
  openGraph: {
    title: 'Risk-Data API — Solana Token Risk Scoring for AI Agents',
    description:
      'One API call before your agent buys: safety score, insider wallet cluster detection, honeypot check, LP lock. Free tier, x402 support.',
    url: 'https://tnt-audit.com/risk-api',
    siteName: 'TNT House',
    images: [
      {
        url: '/tnt-shield-green.png',
        width: 362,
        height: 427,
        alt: 'Risk-Data API — TNT House',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Risk-Data API — Solana Token Risk Scoring for AI Agents',
    description:
      'One API call before your agent buys: safety score, insider wallet cluster detection, honeypot check, LP lock.',
    images: ['/tnt-shield-green.png'],
  },
};

async function getRequestsServedCount(): Promise<number | null> {
  try {
    const { count, error } = await supabaseAdmin
      .from('api_request_log')
      .select('*', { count: 'exact', head: true });
    if (error || count === null) return null;
    return count;
  } catch {
    return null;
  }
}

export default async function RiskApiPage() {
  const requestsServed = await getRequestsServedCount();
  // Deliberately public — this is the whole point of the demo key
  // experiment (see lib/demo-public-key-limit.ts). Read server-side
  // and passed down so it can render in the live-counter widget;
  // null (renders nothing) once the env var is unset again after the
  // experiment concludes.
  const demoKey = process.env.DEMO_PUBLIC_KEY ?? null;

  return (
    <LangProvider>
      <RiskApiPageContent requestsServed={requestsServed} demoKey={demoKey} />
    </LangProvider>
  );
}
