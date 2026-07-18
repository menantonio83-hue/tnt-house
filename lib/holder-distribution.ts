// Version 6.10 — lib/holder-distribution.ts
//
// Wraps the existing checkHolderDistributionRisk() (lib/helius-client.js,
// NOT modified) with a retry, fixing a real bug reported live on BONK
// and USDC: that function returns
//   { riskLevel: 'CRITICAL', holderCount: 0, largestHolderPercent: 100 }
// whenever the underlying getTokenLargestAccounts + getTokenSupply RPC
// pair fails for ANY reason — including a rate-limited or errored
// response from the free public Solana RPC. The error is caught deep
// inside getTopHolders() and silently converted into an empty array,
// which is indistinguishable from "this token genuinely has zero
// holders". A massively-held token like BONK or USDC reporting 0
// holders is a strong signal this is a transient fetch failure, not
// reality — likely made more frequent by Stage 6's timeout fix, which
// lets the background cluster-detection job hit the same public RPC
// more aggressively right around the same time as the main request.
//
// This does NOT edit helius-client.js. It just retries the ambiguous
// zero-holder result a few times with a short backoff: a genuine
// transient RPC failure usually clears on retry, while a token that
// truly has no distributed holders yet will consistently return the
// same result either way, so retrying never makes a real "no holders"
// case worse — it only rescues the false ones.

import { checkHolderDistributionRisk } from '@/lib/helius-client';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 600;

export interface HolderDistributionResult {
  riskLevel: string;
  largestHolderPercent: number;
  top10Percent: number;
  holderCount: number;
}

export async function getHolderDistributionRobust(mint: string): Promise<HolderDistributionResult> {
  let result = await checkHolderDistributionRisk(mint);
  let attempt = 1;

  while (result.holderCount === 0 && attempt < MAX_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * attempt));
    result = await checkHolderDistributionRisk(mint);
    attempt++;
  }

  return result;
}
