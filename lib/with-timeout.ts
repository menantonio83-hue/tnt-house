// Version 6.8 — lib/with-timeout.ts
//
// Root cause of the 502 on real (non-major) tokens: the public Solana
// RPC (api.mainnet-beta.solana.com) and DexScreener are free and
// unauthenticated — fast and reliable for a hugely popular token like
// USDC, but can hang or rate-limit for a less-common one. Node's fetch()
// has no default timeout, so a hang on any of getMintInfo /
// checkHolderDistributionRisk / getDexScreenerData (the last one doing
// TWO sequential RPC round trips internally) could previously run until
// Vercel's own function timeout killed the whole request — which the
// caller sees as a bare platform 502 with no body, not a clean JSON
// error from our own code.
//
// This wraps any promise with a timeout that resolves to a safe fallback
// value instead of letting the request hang. It does NOT abort the
// underlying fetch (the existing lib/helius-client.js calls aren't
// wired for that, and isn't a file this feature touches) — the slow
// call is simply no longer allowed to block the response.

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
