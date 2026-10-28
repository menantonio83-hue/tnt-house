// Version 1.2 — app/risk-api/docs/page.tsx
//
// v1.2: og:url moved to https://www.tnt-audit.com (the canonical host;
// the bare domain redirects), added alternates.canonical, and the
// descriptions now mention the MCP server section.
//
// v1.1: added openGraph/twitter metadata (og:title, og:description,
// og:image) so links shared on X/Telegram/HN/Product Hunt render a
// proper card instead of a bare URL — see app/risk-api/page.tsx v5.8
// for the sibling fix on the landing page.
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
    'Full technical reference for the Risk-Data API: response schema, MCP server, rate limiting, webhooks, changelog, and pricing.',
  alternates: {
    canonical: 'https://www.tnt-audit.com/risk-api/docs',
  },
  openGraph: {
    title: 'Risk-Data API — Docs',
    description:
      'Full technical reference: response schema, MCP server, rate limiting, webhooks, changelog, and pricing for the Solana token risk-scoring API.',
    url: 'https://www.tnt-audit.com/risk-api/docs',
    siteName: 'TNT House',
    images: [
      {
        url: '/tnt-shield-green.png',
        width: 362,
        height: 427,
        alt: 'Risk-Data API — Docs — TNT House',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Risk-Data API — Docs',
    description:
      'Full technical reference: response schema, MCP server, rate limiting, webhooks, changelog, and pricing.',
    images: ['/tnt-shield-green.png'],
  },
};

export default function RiskApiDocsPage() {
  return (
    <LangProvider>
      <RiskApiDocsContent />
    </LangProvider>
  );
}
