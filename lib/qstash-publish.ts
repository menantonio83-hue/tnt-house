// Version 1.0 — lib/qstash-publish.ts
//
// Thin wrapper over the QStash publish API — used to deliver triggered
// webhook callbacks. Publishing THROUGH QStash (instead of POSTing
// callback_url directly from inside /webhooks/check) is what gets us
// retry-with-backoff for free: QStash retries a failing delivery on its
// own schedule (the `retries` option below), so no backoff logic is
// reimplemented in this repo.
//
// REQUIRED env vars (from the Upstash Console -> QStash tab — added to
// Vercel manually, same as the Redis integration's env vars, since
// QStash is a separate Vercel Marketplace integration from Upstash for
// Redis): QSTASH_TOKEN, QSTASH_URL.

import { Client } from '@upstash/qstash';

const qstashToken = process.env.QSTASH_TOKEN;
const qstashUrl = process.env.QSTASH_URL;

if (!qstashToken) {
  console.error(
    '[qstash-publish] QSTASH_TOKEN is not set. Webhook deliveries will fail to publish until it is configured in Vercel project settings.',
  );
}

const qstash = new Client({
  token: qstashToken || 'missing-qstash-token',
  baseUrl: qstashUrl,
});

export async function publishWebhookDelivery(
  callbackUrl: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await qstash.publishJSON({
      url: callbackUrl,
      body,
      headers,
      retries: 3, // exponential backoff, handled entirely by QStash
    });
    return { ok: true, messageId: (res as any).messageId };
  } catch (e: any) {
    console.error('[qstash-publish] publish failed:', e.message);
    return { ok: false, error: e.message };
  }
}
