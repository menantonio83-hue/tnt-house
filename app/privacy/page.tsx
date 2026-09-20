// Version 1.0 — app/privacy/page.tsx
//
// Did not exist before. The Service collects more than it might look
// like at a glance — IP + browser fingerprint for rate limiting
// (lib/quick-check-limit.ts), wallet addresses for payment verification,
// optional email at Risk-Data API signup, and usage analytics — with no
// page anywhere disclosing any of it.
//
// Drafted as a reasonable starting template describing what the code
// actually does today, not a substitute for a lawyer's review (e.g. for
// GDPR applicability given an EU-based operator) — see the
// founder-facing note left in chat alongside this PR.

import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy — TNT House',
  description: 'What TNT House collects, why, and how it is used.',
};

export default function PrivacyPage() {
  return (
    <LegalShell active="/privacy" title="Privacy Policy" updated="September 2026">
      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">1. No Account System</h2>
        <p>
          TNT House has no user accounts, no passwords, and no login. Most of the Service is
          usable anonymously. Where identity matters at all (free-tier limits, paid credits, API
          keys), it is tracked by the minimal signal needed — described below — not by a profile.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">2. What We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="text-slate-200 font-semibold">Token addresses you submit</span> for audit or listing — already-public on-chain data.</li>
          <li><span className="text-slate-200 font-semibold">Wallet address and transaction signature</span> when you pay via Solana Pay, to verify and credit your payment.</li>
          <li><span className="text-slate-200 font-semibold">IP address and a random httpOnly fingerprint cookie</span>, used only to enforce free-tier daily limits and to reduce abuse (see lib/quick-check-limit.ts). The cookie carries no personal profile — just a rate-limit counter.</li>
          <li><span className="text-slate-200 font-semibold">API key and, if you provide one, an email</span>, if you sign up for Risk-Data API access — used for authentication, usage/billing tracking, and service notices.</li>
          <li><span className="text-slate-200 font-semibold">Aggregate usage analytics</span> (page views, general traffic patterns) via Vercel Analytics.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">3. What We Do Not Collect</h2>
        <p>
          We never see or store your private keys or seed phrase — payments are signed entirely
          inside your own wallet extension. We do not run KYC and do not collect government ID.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">4. How We Use It</h2>
        <p>
          To deliver the Service (run your audit, verify your payment, list your token,
          authenticate your API calls), enforce free-tier and rate limits fairly, detect abuse,
          and understand aggregate traffic. We do not sell personal data.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">5. Third-Party Services</h2>
        <p>We rely on the following infrastructure and data providers, each under its own privacy policy:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase (database), Vercel (hosting, analytics), Upstash (rate-limit storage)</li>
          <li>Helius, Solana Tracker, RugCheck, and DexScreener (on-chain and market data)</li>
          <li>Telegram Bot API (internal alerts to our team — not for marketing to you unless you message our bot yourself)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">6. Cookies</h2>
        <p>
          A single httpOnly fingerprint cookie is set for Quick Check rate limiting. It is not
          used for advertising or cross-site tracking.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">7. Data Retention</h2>
        <p>
          Payment and usage logs are kept as long as needed for billing accuracy, abuse
          prevention, and legal/accounting requirements. Rate-limit counters reset automatically
          (daily for free-tier counts).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">8. Your Rights</h2>
        <p>
          Since there is no account system, most of what we hold is either public on-chain data or
          minimal rate-limit/billing records. To ask what we hold tied to your API key or wallet
          address, or to request deletion where we are able to, contact us on Telegram (below).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">9. Children</h2>
        <p>The Service is not directed at, and is not intended for use by, anyone under 18.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-emerald-400 mb-2">10. Changes to This Policy</h2>
        <p>
          We may update this policy as the Service evolves. The &quot;Last updated&quot; date
          above reflects the most recent revision.
        </p>
      </section>
    </LegalShell>
  );
}
