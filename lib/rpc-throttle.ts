// Version 1.1 — lib/rpc-throttle.ts
//
// Process-wide RPC rate limiter. Free Helius allows 10 requests/sec; the
// insider-cluster scan used to fire up to 8 holder pipelines at once, each
// issuing several calls, which produced constant "429 Too Many Requests"
// retries (0.5s -> 4s backoff inside web3.js) and slowed scans down.
//
// Usage: pass `throttledFetch` as the `fetch` option of a web3.js
// Connection. All requests made through it in this server instance share
// one schedule, so concurrent scans cannot exceed the budget together.
// Set RPC_MAX_RPS in env to tune (default 8 = safe margin under 10).

const MAX_RPS = Math.max(1, Number(process.env.RPC_MAX_RPS) || 8);
const MIN_INTERVAL_MS = Math.ceil(1000 / MAX_RPS);

// Next free send slot (epoch ms). Slots are handed out synchronously, so
// callers queue in order without any timers being shared.
let nextSlotAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttledFetch(input: any, init?: any): Promise<Response> {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + MIN_INTERVAL_MS;
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
  return fetch(input, init);
}
