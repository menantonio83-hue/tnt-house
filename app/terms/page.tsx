// Version 1.0 — app/terms/page.tsx
//
// Did not exist before. TNT House accepts real crypto payment for
// listings/banners/audits and the Risk-Data API sells metered API
// access, with no terms governing either — no refund policy, no
// prohibited-use clause, no liability limitation, no statement of what
// the service does and does not promise.
//
// GOVERNING LAW (section 9) is left as a placeholder: filling it in
// correctly depends on facts I don't have (registered entity, if any,
// and jurisdiction) and is a legal decision, not a coding one — see the
// founder-facing note left in chat alongside this PR. Drafted as a
// starting template, not a substitute for a lawyer's review.

import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: 'Terms of Service — TNT House',
  description: 'Terms governing use of TNT House, its token listings, and the Risk-Data API.',
};

export default function TermsPage() {
  return (
    <LegalShell active="/terms" title="Terms of Service" updated="September 2026">
      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">1. Acceptance</h2>
        <p>
          By using tnt-audit.com, the Risk-Data API, or any related bot, widget, or integration
          (together, the &quot;Service&quot;), you agree to these Terms and to our{' '}
          <a href="/disclaimer" className="text-purple-400 hover:text-purple-300">
            Disclaimer
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-purple-400 hover:text-purple-300">
            Privacy Policy
          </a>
          . If you do not agree, do not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">2. What the Service Is</h2>
        <p>
          TNT House provides automated Solana token analysis (Safety Score, mint/freeze authority,
          honeypot detection, LP-lock status, insider-cluster detection), a token discovery table,
          paid listing/banner slots, and the Risk-Data API — a metered JSON endpoint exposing the
          same underlying analysis for programmatic (including AI-agent) use. See our{' '}
          <a href="/disclaimer" className="text-purple-400 hover:text-purple-300">
            Disclaimer
          </a>{' '}
          for what the Service is not.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">3. Risk-Data API — Additional Terms</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for keeping your API key confidential. Traffic on your key is treated as yours.</li>
          <li>Rate limits and quotas apply per your tier and may change; we will not silently reduce a paid tier's published limits without notice.</li>
          <li>The API is provided on a best-effort uptime basis. We do not guarantee a specific SLA unless separately agreed in writing.</li>
          <li>You may not resell raw API responses as a standalone competing data feed without our written consent; using the data inside your own product (e.g., a trading bot's decision logic) is the intended use.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">4. Payments</h2>
        <p>
          Payments are accepted in SOL, USDC, and $MRDT via Solana Pay. Prices shown in USD are
          approximate targets settled in the fluctuating value of the crypto asset used — the
          on-chain transaction, once confirmed, is final. Because blockchain transactions cannot
          be reversed, all payments are non-refundable except where required by applicable law.
          If you believe a payment was not credited due to a technical fault on our side, contact
          us (see below) with your transaction signature.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">5. Prohibited Use</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Attempting to circumvent rate limits, free-tier caps, or payment via automation, multiple identities, or exploiting bugs.</li>
          <li>Using the Service to facilitate fraud, market manipulation, or to misrepresent a token's audit status.</li>
          <li>Scraping or reverse-engineering the Service to build a directly competing product from our outputs.</li>
          <li>Any use that violates applicable law.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">6. Intellectual Property</h2>
        <p>
          The TNT House name, branding, scoring methodology, and site/API code are our property.
          Token data displayed (prices, liquidity, holder counts, etc.) is sourced from public
          on-chain data and third-party providers and is not owned by us.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">7. No Warranty; Limitation of Liability</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranty of any kind, express or
          implied, including accuracy, availability, or fitness for a particular purpose. To the
          maximum extent permitted by law, TNT House and its operator are not liable for any
          indirect, incidental, or consequential damages, including trading losses, arising from
          use of the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">8. Changes to These Terms</h2>
        <p>
          We may update these Terms as the Service evolves. Continued use after an update means
          you accept the revised Terms. The &quot;Last updated&quot; date above reflects the most
          recent revision.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">9. Governing Law</h2>
        <p className="text-amber-400/90 border border-amber-500/30 rounded-lg p-3 bg-amber-500/5">
          [Placeholder — to be completed by the operator with the applicable jurisdiction before
          this page is relied on. Not filled in automatically because it depends on facts (entity
          status, place of operation) that require your own decision, not a code change.]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">10. Contact</h2>
        <p>Questions about these Terms — reach us on Telegram (link below).</p>
      </section>
    </LegalShell>
  );
}
