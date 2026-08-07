// Version 1.0 — lib/send-email.ts
//
// Sends the newly-issued API key + a copy-pasteable curl example to the
// signup email, as a backup to the on-screen display in
// RiskApiSignupForm.tsx — see that file's CopyButton.tsx: clipboard
// writes can fail silently (permission-restricted in-app browsers like
// Telegram/X/Discord's built-in webviews are the most likely real-world
// case for this exact product's audience), and the signup key is shown
// ONCE with no server-side plaintext retention (see app/api/v1/signup/
// route.ts) — if the on-screen copy is lost, email is the only recovery
// path that doesn't require us manually reissuing.
//
// Uses Resend (resend.com), added via the Vercel Marketplace
// integration the same way Upstash Redis / QStash were — same
// Marketplace-injects-env-vars pattern, this time RESEND_API_KEY.
//
// FAIL-SOFT BY DESIGN: this function is called fire-and-forget
// (waitUntil) from signup/route.ts and must NEVER be the reason a
// signup fails. If RESEND_API_KEY isn't set yet (integration not
// connected), or the Resend API call itself fails for any reason, this
// logs a warning and returns — the person still gets their key on
// screen either way, exactly as before this file existed. Email is a
// backup channel, not a dependency.
//
// SENDER DOMAIN: defaults to Resend's own onboarding@resend.dev sandbox
// address, which works with zero setup but often lands in spam and
// looks unpolished. Set EMAIL_FROM_ADDRESS (e.g.
// "noreply@tnt-audit.com") once the tnt-audit.com domain is verified in
// the Resend dashboard (Domains -> Add Domain -> a few DNS records) —
// no code change needed here when that happens, just the env var.

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'TNT House Risk-Data API <onboarding@resend.dev>';

interface SendKeyEmailParams {
  to: string;
  apiKey: string;
  dailyLimit: number;
}

export async function sendApiKeyEmail({ to, apiKey, dailyLimit }: SendKeyEmailParams): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[send-email] RESEND_API_KEY not set — skipping email, key was still shown on screen.');
    return;
  }

  const fromAddress = process.env.EMAIL_FROM_ADDRESS
    ? `TNT House Risk-Data API <${process.env.EMAIL_FROM_ADDRESS}>`
    : DEFAULT_FROM;

  const curlExample = `curl "https://tnt-audit.com/api/v1/token-risk?mint=<MINT_ADDRESS>" \\\n  -H "Authorization: Bearer ${apiKey}"`;

  const html = `
    <div style="font-family: monospace, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0a0a0f; color: #e2e2e2;">
      <h2 style="color: #a78bfa;">Your TNT House Risk-Data API key</h2>
      <p>Your free-tier key (${dailyLimit} requests/day) is ready:</p>
      <div style="background: #000; border: 1px solid #a78bfa55; border-radius: 6px; padding: 12px; margin: 16px 0; word-break: break-all; color: #c4b5fd;">
        ${apiKey}
      </div>
      <p>Quick start:</p>
      <pre style="background: #000; border: 1px solid #a78bfa55; border-radius: 6px; padding: 12px; overflow-x: auto; color: #6ee7b7; font-size: 13px;">${curlExample}</pre>
      <p style="color: #fbbf24; font-size: 13px;">⚠️ This key is shown once on the website and cannot be retrieved again there — keep this email as your backup.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Docs: <a href="https://tnt-audit.com/risk-api" style="color: #a78bfa;">tnt-audit.com/risk-api</a>
      </p>
    </div>
  `.trim();

  const text = `Your TNT House Risk-Data API key (${dailyLimit} requests/day):\n\n${apiKey}\n\nQuick start:\n${curlExample}\n\nThis key is shown once on the website and cannot be retrieved again there — keep this email as your backup.\n\nDocs: https://tnt-audit.com/risk-api`;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: 'Your TNT House Risk-Data API key',
        html,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[send-email] Resend API returned ${res.status}: ${body}`);
    }
  } catch (e) {
    console.error('[send-email] Failed to send key email:', (e as Error).message);
  }
}
