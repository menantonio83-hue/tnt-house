// Version 1.0 — lib/webhook-signature.ts
//
// Stripe-style HMAC-SHA256 signing for webhook deliveries. The secret
// is generated once at subscribe time and returned ONCE in that
// response — never retrievable again. Unlike an API key (hash-only
// storage, we never need the raw value back), this secret IS kept
// server-side in plaintext, because we need it again every time a
// webhook fires to sign the next delivery — same model as Stripe's own
// webhook signing secrets.

import crypto from 'crypto';

export function generateWebhookSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('hex');
}

// Combined header value: "t=<unix_ts>,v1=<hex hmac>" (Stripe's exact
// convention). The timestamp is folded into the signed string so a
// captured payload+signature pair can't be replayed indefinitely later
// by whoever intercepts one delivery — a receiver should reject
// anything where `t` is too far in the past.
export function signWebhookHeader(secret: string, payload: unknown): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedString = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(signedString).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}
