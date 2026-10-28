// Version 1.0 — app/agent-access/page.tsx
//
// v1.0: static instruction page for anonymous refusals. Explains free key, x402, and higher-volume paid access for an AI agent that hit the anonymous limit.

import type { Metadata } from 'next';
import {
  MIN_TOPUP_USD,
  MAX_TOPUP_USD,
  SUBSCRIPTION_USD,
  SUBSCRIPTION_MONTHLY_QUOTA,
} from '@/lib/billing-pricing';
import { SITE_ORIGIN, X402_PRICE_USD } from '@/lib/refusal-options';

export const metadata: Metadata = {
  title: 'Give your AI agent access — RiskDataApi',
};

export default function AgentAccessPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Give your AI agent access</h1>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What happened</h2>
          <p className="mt-3 text-sm text-neutral-300">
            Your AI agent used its free anonymous RiskDataApi calls for today. Anonymous callers get
            5 successful calls per day with no signup, then we ask for one of the following to
            continue.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Option 1 — Free API key (15 calls/day)</h2>
          <p className="mt-3 text-sm text-neutral-300">
            Your agent can self-serve this without a human:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-neutral-300">
            <li>
              Call the MCP tool <code className="text-neutral-100">get_free_api_key</code> with{' '}
              <code className="text-neutral-100">{'{"email":"you@example.com"}'}</code>
            </li>
            <li>
              Or POST <code className="text-neutral-100">{SITE_ORIGIN}/api/v1/signup</code> with{' '}
              <code className="text-neutral-100">{'{"email":"you@example.com"}'}</code>
            </li>
            <li>
              Or use the form at{' '}
              <a href="/risk-api" className="text-blue-400 underline">
                /risk-api
              </a>
            </li>
          </ul>
          <p className="mt-3 text-sm text-neutral-300">
            Then the agent sends{' '}
            <code className="text-neutral-100">Authorization: Bearer &lt;key&gt;</code> (or the{' '}
            <code className="text-neutral-100">api_key</code> argument).
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Option 2 — x402 pay per call (no account)</h2>
          <p className="mt-3 text-sm text-neutral-300">
            The agent can pay ${X402_PRICE_USD} USDC on Solana per call, no account needed:
          </p>
          <p className="mt-2 text-sm">
            <code className="text-neutral-100">
              GET {SITE_ORIGIN}/api/v1/token-risk/x402?mint=&lt;mint&gt;
            </code>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Option 3 — More volume</h2>
          <p className="mt-3 text-sm text-neutral-300">
            Top-ups (${MIN_TOPUP_USD}–${MAX_TOPUP_USD}) or{' '}
            ${SUBSCRIPTION_USD}/30 days for {SUBSCRIPTION_MONTHLY_QUOTA} calls once you have a key.
          </p>
          <p className="mt-2 text-sm text-neutral-300">
            The agent can call the MCP tools{' '}
            <code className="text-neutral-100">create_topup_invoice</code> +{' '}
            <code className="text-neutral-100">check_payment</code>, or use the form at{' '}
            <a href="/risk-api" className="text-blue-400 underline">
              /risk-api
            </a>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">MCP endpoint</h2>
          <p className="mt-3 text-sm text-neutral-300">
            <code className="text-neutral-100">{SITE_ORIGIN}/api/mcp</code>
          </p>
        </section>
      </div>
    </main>
  );
}
