// Version 1.0 — app/risk-api/docs/page.tsx
//
// New route. Thin server wrapper (same pattern as app/risk-api/page.tsx
// v5.6) so `export const metadata` keeps working, wrapping the new
// client component RiskApiDocsContent with the same LangProvider used
// on the landing page — one shared language preference across both
// routes via the same 'tnt_lang' localStorage key.

import type { Metadata } from 'next';
import { LangProvider } from '../LangContext';
import RiskApiDocsContent from '../RiskApiDocsContent';

export const metadata: Metadata = {
  title: 'Risk-Data API — Docs — TNT House',
  description:
    'Full technical reference for the Risk-Data API: response schema, rate limiting, webhooks, changelog, and pricing.',
};

export default function RiskApiDocsPage() {
  return (
    <LangProvider>
      <RiskApiDocsContent />
    </LangProvider>
  );
}
