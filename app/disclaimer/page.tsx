// Version 1.0 — app/disclaimer/page.tsx
//
// Did not exist before. The site takes real payment (SOL/USDC/$MRDT)
// for "security audits" and displays a 0-100 "Safety Score" that a
// visitor can reasonably read as a professional guarantee — with no
// disclaimer anywhere stating the analysis is automated, not
// infallible, and not investment advice. This is the single highest
// legal-exposure gap identified in the 2026-09-21 site review.
//
// Drafted as a reasonable starting template, not a substitute for a
// lawyer's review — see the founder-facing note left in chat alongside
// this PR.

import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: 'Disclaimer — TNT House',
  description:
    'TNT House provides automated, AI-assisted token analysis. This is not financial advice and carries no guarantee of accuracy.',
};

export default function DisclaimerPage() {
  return (
    <LegalShell active="/disclaimer" title="Disclaimer" updated="September 2026">
      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">1. Not Financial or Investment Advice</h2>
        <p>
          Nothing on TNT House (tnt-audit.com), the Risk-Data API, or any associated page, widget,
          bot reply, or Telegram/X post is financial, investment, legal, or tax advice. Safety
          Scores, insider-cluster findings, honeypot flags, LP-lock status, and every other output
          are informational signals only. They are not a recommendation to buy, sell, or hold any
          token, and they do not predict future price or performance.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">2. Automated Analysis — No Guarantee of Accuracy</h2>
        <p>
          Our scoring engine combines on-chain data (via third-party RPC and indexing providers),
          heuristic checks, and AI-assisted pattern detection (including our insider-cluster
          analysis). It is built carefully, but it is software: it can miss risks, misread
          contract logic, mis-cluster wallets, or be fooled by a project specifically designed to
          evade automated detection. A high Safety Score is not a certification that a token is
          safe, legitimate, or free of malicious code, and a low score does not itself prove a
          project is fraudulent.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">3. Do Your Own Research</h2>
        <p>
          Use our output as one input among many, not as a substitute for your own due diligence.
          The Solana ecosystem moves fast, contracts can be upgraded or replaced, and liquidity,
          holder distribution, and team behavior can change after an audit was run. Always verify
          independently before risking funds.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">4. No Affiliation With Referenced Projects or People</h2>
        <p>
          Token names, tickers, logos, or branding submitted for audit or listing — including any
          that reference a public figure, brand, or third party — are provided by the submitter,
          not created, endorsed, or verified as authorized by TNT House. Appearing in our table,
          receiving a score, or being listed does not imply any affiliation, partnership, or
          endorsement between TNT House and that project, person, or brand, in either direction.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">5. Assumption of Risk</h2>
        <p>
          Cryptocurrency and DeFi carry substantial risk, including total loss of funds. By using
          this site or API you accept that risk. TNT House, its operator, and its contributors are
          not liable for trading losses, missed gains, or other damages arising from reliance on
          our output — see our{' '}
          <a href="/terms" className="text-purple-400 hover:text-purple-300">
            Terms of Service
          </a>{' '}
          for the full limitation of liability.
        </p>
      </section>
    </LegalShell>
  );
}
