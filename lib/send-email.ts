// Version 1.3 — lib/send-email.ts
//
// v1.3: added a plain-language "no-code" section to the email, after
// Бро pointed out the curl example alone means nothing to someone who
// isn't already a developer but wants to plug this into a bot/AI
// assistant — a real, previously-seen failure mode (Blossom Scanner's
// 401s earlier were consistent with exactly this: someone with a key
// but no clear idea how to actually wire up the Authorization header).
// Added: a Python snippet (most common language for the kind of
// trading-bot audience this API targets) and a one-paragraph tip to
// literally paste the curl command + "I'm using [language]" into an AI
// assistant (Claude/ChatGPT) and ask it to wire up the integration —
// genuinely the most accessible path for a non-developer, not a
// throwaway line. No change to the fail-soft/fallback logic below,
// content-only addition.
//
// Version 1.2 — lib/send-email.ts
//
// v1.2: AUTOMATIC FALLBACK when the custom domain isn't verified yet.
// Caught live: first real signup after connecting Resend got a silent
// non-delivery — Resend's API correctly rejected the send with 403
// "The tnt-audit.com domain is not verified", but this file just
// logged it and gave up, matching v1.0/v1.1's fail-soft design ("never
// block the signup") a little TOO literally — the person got their key
// on screen (fine) but the promised email backup silently never
// existed (not fine, and not obviously visible without checking logs).
//
// Fix: if the RESEND_EMAIL_DOMAIN send comes back with Resend's
// specific "domain not verified" validation_error, retry ONCE
// immediately with the always-available onboarding@resend.dev sandbox
// address instead of just giving up. Once tnt-audit.com is verified in
// the Resend dashboard (Domains -> Add Domain -> DNS records), sends
// will succeed on the first try and this fallback path simply never
// triggers again — no code change needed for that transition either.
//
// Version 1.1 — lib/send-email.ts
//
// v1.1: FIXED WRONG ENV VAR NAME — assumed EMAIL_FROM_ADDRESS (a full
// email like "noreply@tnt-audit.com"), but the actual Vercel Marketplace
// Resend integration (connected 2026-08-07) creates RESEND_EMAIL_DOMAIN
// instead — just the bare domain (e.g. "tnt-audit.com"), not a full
// address. Confirmed directly from the Environment Variables page:
// RESEND_API_KEY + RESEND_EMAIL_DOMAIN, both "Production and Preview".
// Same "wrong assumed name, fix once confirmed against the real
// dashboard" pattern as lib/demo-limit.ts's KV_REST_API_* discovery —
// this one was caught before deploy instead of after, by actually
// checking the Environment Variables screenshot rather than assuming.
//
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
// SENDER DOMAIN: reads RESEND_EMAIL_DOMAIN (set automatically by the
// Vercel Marketplace Resend integration once a domain is verified —
// just the bare domain, e.g. "tnt-audit.com", NOT a full email
// address). Falls back to Resend's own onboarding@resend.dev sandbox
// address with zero setup if that var isn't set yet (works, but often
// lands in spam and looks unpolished).

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

  const fromAddress = process.env.RESEND_EMAIL_DOMAIN
    ? `TNT House Risk-Data API <noreply@${process.env.RESEND_EMAIL_DOMAIN}>`
    : DEFAULT_FROM;

  const curlExample = `curl "https://tnt-audit.com/api/v1/token-risk?mint=<MINT_ADDRESS>" \\\n  -H "Authorization: Bearer ${apiKey}"`;

  const pythonExample = `import requests\n\nresponse = requests.get(\n    "https://tnt-audit.com/api/v1/token-risk",\n    params={"mint": "<MINT_ADDRESS>"},\n    headers={"Authorization": "Bearer ${apiKey}"}\n)\ndata = response.json()\nprint(data["safety_score"])  # 0-100, higher = safer`;

  const html = `
    <div style="font-family: monospace, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0a0a0f; color: #e2e2e2;">
      <h2 style="color: #a78bfa;">Your TNT House Risk-Data API key</h2>
      <p>Your free-tier key (${dailyLimit} requests/day) is ready:</p>
      <div style="background: #000; border: 1px solid #a78bfa55; border-radius: 6px; padding: 12px; margin: 16px 0; word-break: break-all; color: #c4b5fd;">
        ${apiKey}
      </div>
      <p>Quick start (terminal / any HTTP client):</p>
      <pre style="background: #000; border: 1px solid #a78bfa55; border-radius: 6px; padding: 12px; overflow-x: auto; color: #6ee7b7; font-size: 13px;">${curlExample}</pre>
      <p>Quick start (Python, e.g. for a trading bot):</p>
      <pre style="background: #000; border: 1px solid #a78bfa55; border-radius: 6px; padding: 12px; overflow-x: auto; color: #6ee7b7; font-size: 13px; white-space: pre-wrap;">${pythonExample}</pre>
      <div style="background: #1e1b3a; border: 1px solid #a78bfa55; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #d4d4d8;">
        <strong style="color: #a78bfa;">Not a developer?</strong> Paste the code block above into ChatGPT or Claude along with "wire this into my [Telegram bot / trading bot / whatever you're building], written in [your language]" — any AI assistant can do the integration for you from just that.
      </div>
      <p style="color: #fbbf24; font-size: 13px;">⚠️ This key is shown once on the website and cannot be retrieved again there — keep this email as your backup.</p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Docs: <a href="https://tnt-audit.com/risk-api" style="color: #a78bfa;">tnt-audit.com/risk-api</a>
      </p>
    </div>
  `.trim();

  const text = `Your TNT House Risk-Data API key (${dailyLimit} requests/day):\n\n${apiKey}\n\nQuick start (terminal):\n${curlExample}\n\nQuick start (Python):\n${pythonExample}\n\nNot a developer? Paste the code above into ChatGPT or Claude along with "wire this into my [Telegram bot / trading bot], written in [your language]" — any AI assistant can do the integration for you.\n\nThis key is shown once on the website and cannot be retrieved again there — keep this email as your backup.\n\nDocs: https://tnt-audit.com/risk-api`;

  const attempt = await sendViaResend(resendApiKey, fromAddress, to, html, text);

  // v1.2: the ONE Resend error worth a fallback retry — domain not
  // verified yet is a temporary, known, self-resolving state (fixed by
  // finishing DNS verification in the Resend dashboard, not by us).
  // Every other failure (bad API key, rate limit, network error, etc.)
  // just logs and gives up, same as before — retrying those wouldn't
  // help and could mask a real problem.
  if (!attempt.ok && attempt.status === 403 && attempt.body?.includes('domain is not verified')) {
    console.warn(
      `[send-email] Custom domain (${fromAddress}) not verified yet — retrying with sandbox address.`,
    );
    const retry = await sendViaResend(resendApiKey, DEFAULT_FROM, to, html, text);
    if (!retry.ok) {
      console.error(`[send-email] Sandbox fallback also failed: ${retry.status} ${retry.body}`);
    }
    return;
  }

  if (!attempt.ok) {
    console.error(`[send-email] Resend API returned ${attempt.status}: ${attempt.body}`);
  }
}

interface ResendAttempt {
  ok: boolean;
  status: number;
  body: string;
}

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  html: string,
  text: string,
): Promise<ResendAttempt> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Your TNT House Risk-Data API key',
        html,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = res.ok ? '' : await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message };
  }
}
