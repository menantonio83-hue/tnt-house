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

export const metadata: Metadata = {
  title: 'Risk-Data API — TNT House',
  description:
    'Insider-cluster detection and Solana token risk scoring as a JSON API, built for AI trading agents.',
};

export default function RiskApiPage() {
  return (
    <LangProvider>
      <RiskApiPageContent />
    </LangProvider>
  );
}
