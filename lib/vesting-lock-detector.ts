// Version 1.2 — lib/vesting-lock-detector.ts
//
// v1.2: fixed a SECOND precision bug found live on the same MRDT test
// right after v1.1's fix — "Assertion failed" from bn.js. v1.1 built
// totalSupplyBN via `new BN(Math.round(totalSupply))`, but totalSupply
// itself was ALREADY a lossy JS number (holder-distribution.ts parses
// the RPC's exact decimal string through parseInt, which silently
// loses precision past Number.MAX_SAFE_INTEGER — MRDT's raw supply is
// ~9.98e17, over 100x past that limit). Constructing a BN from an
// already-imprecise huge float trips a different internal bn.js
// assertion than the one v1.1 fixed. Real fix: take the RPC's exact
// decimal STRING (holder-distribution.ts v6.19's new totalSupplyRaw
// field) and build the BN directly from that — bn.js parses decimal
// strings with no JS-number intermediate step, so there's no magnitude
// limit to trip on regardless of how large the mint's raw supply is.
//
// Version 1.1 — lib/vesting-lock-detector.ts
//
// v1.1: fixed a real production crash — "Number can only safely store
// up to 53 bits" — caught live on MRDT's own vesting lock (raw
// depositedAmount as atomic units: 998346736293317600, far past
// Number.MAX_SAFE_INTEGER ~9.007e15). getNumberFromBN(bn, 0) calls
// BN.toNumber() internally, which THROWS (unlike a plain Number cast,
// which would just silently lose precision) once the magnitude exceeds
// 53 bits — exactly what a high-decimal mint's raw token amounts do
// routinely. Fixed by never converting the raw deposited/unlocked
// amounts to JS Number at all: percentOf() does the division entirely
// in BN arithmetic (numerator.muln(1000).div(denominator)) and only
// calls .toNumber() on the final result, which is always a small,
// bounded percentage (0-1000-ish) — safely within 53 bits regardless
// of how large the underlying token amounts are. This bug meant
// vesting_locks silently came back empty for every real lock detected
// so far (search itself succeeded; only the post-processing threw,
// caught by this file's own try/catch — exactly as designed, just
// hiding a bug rather than a genuine "no lock found").
//
// Version 1.0 — lib/vesting-lock-detector.ts
//
// Detects Solana vesting/lock contracts among a token's top holders, so
// concentration-risk scoring (holder-distribution.ts's top10Percent /
// token-risk-core.ts's marketHealthCap) can tell "67% locked in a
// verifiable on-chain vesting schedule" apart from "67% sitting in one
// freely-spendable wallet" — two very different risk profiles that
// used to score identically. See the 2026-08-08 conversation with
// Бро (Frohorse/MRDT vesting example) and the 3-model architecture
// review (Kimi/DeepSeek/Gemini) that this design follows.
//
// v1 scope, deliberately narrow:
// - Streamflow only (dominant Solana vesting protocol, official program
//   ID strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m). A registry/adapter
//   pattern (VESTING_ADAPTERS below) makes adding Bonfida/Jupiter Lock/
//   others later a matter of writing one more adapter, not touching
//   this file's control flow.
// - Uses the OFFICIAL @streamflow/stream SDK's searchStreams({ mint })
//   rather than hand-deriving PDAs or hand-rolling Borsh parsing for a
//   protocol we don't control — confirmed via their own SolanaStreamClient
//   source that this is exactly how their PROGRAM_ID + STREAM_STRUCT_
//   OFFSET_MINT memcmp filter is meant to be used (same technique their
//   own `.get()` method uses for sender/recipient lookups).
// - Deliberately does NOT attempt to detect unknown/unrecognized PDAs
//   holding large balances. Rejected in review: AMM/DEX liquidity pool
//   accounts (Raydium, Orca, Meteora, pump.fun bonding curves) are ALSO
//   PDAs and routinely hold a large share of supply for any actively-
//   traded token — a generic "penalize unrecognized large PDA holder"
//   heuristic would misfire constantly on completely healthy tokens.
//   That's a separate, larger problem (classifying known DEX pool
//   addresses) tracked as a future backlog item, not solved here.
// - cancelableBySender === true gets ZERO discount — a stream the
//   creator can cancel and reclaim at will isn't a real lock from the
//   perspective of "can this supply be dumped", regardless of the
//   nominal unlock schedule. Consensus across all reviewers on this.
//
// Fail-safe by design: any error (RPC failure, SDK exception, no
// streams found) resolves to an empty result, never throws — a
// vesting-detection hiccup must never break the base token-risk
// response. Same philosophy as RUGCHECK_FALLBACK elsewhere in this
// codebase.

import { SolanaStreamClient, ICluster } from '@streamflow/stream';
import BN from 'bn.js';

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

// 30-day window for "unlocking soon" — see this file's header and the
// 2026-08-08 review: kept as a fixed v1 default rather than a
// liquidity-adjusted threshold (Unlock-to-Liquidity Ratio), which all
// three model reviews suggested as a real v2 improvement but agreed
// isn't required to ship a correct v1.
const SOON_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export interface VestingLock {
  protocol: 'streamflow';
  holder_address: string;
  percent_of_supply: number;
  unlocked_now_percent: number;
  unlocks_within_30d_percent: number;
  next_unlock_at: string | null;
  fully_unlocked_at: string | null;
  cancelable_by_sender: boolean;
}

let cachedClient: SolanaStreamClient | null = null;
function getClient(): SolanaStreamClient {
  if (!cachedClient) {
    cachedClient = new SolanaStreamClient(HELIUS_RPC_URL, ICluster.Mainnet);
  }
  return cachedClient;
}

// Returns every Streamflow vesting/lock stream found for this mint,
// regardless of whether the recipient is currently a top holder — the
// caller (token-risk-core.ts) matches these against the top-N holder
// list it already fetched. Never throws.
//
// totalSupplyRaw MUST be the exact RPC decimal string (holder-
// distribution.ts's totalSupplyRaw field), not a JS-number conversion
// of it — see this file's v1.2 header for why.
export async function findStreamflowLocks(mint: string, totalSupplyRaw: string): Promise<VestingLock[]> {
  if (!totalSupplyRaw || totalSupplyRaw === '0') return [];

  try {
    const client = getClient();
    const results = await client.searchStreams({ mint });

    const now = Math.floor(Date.now() / 1000);
    const soon = now + SOON_WINDOW_SECONDS;
    // Built directly from the exact RPC string — bn.js parses decimal
    // strings digit-by-digit with no intermediate JS-number step, so
    // there's no magnitude limit here (unlike new BN(hugeJsNumber),
    // which either silently carries forward whatever precision that
    // number already lost, or throws outright — confirmed live, see
    // v1.2 header).
    const totalSupplyBN = new BN(totalSupplyRaw);

    // Percent-of-X as a one-decimal-precision integer, computed entirely
    // in BN arithmetic (numerator.muln(1000).div(denominator)) so the
    // only value ever handed to .toNumber() is the small, bounded
    // result (0-1000ish) — never the raw token amount itself, which for
    // a high-decimal mint like this one is `998346736293317600` atomic
    // units, comfortably past Number.MAX_SAFE_INTEGER (~9.007e15) and
    // exactly what threw "Number can only safely store up to 53 bits"
    // in production before this fix.
    function percentOf(numerator: BN, denominator: BN): number {
      if (denominator.isZero()) return 0;
      return numerator.muln(1000).div(denominator).toNumber() / 10;
    }

    return results
      .filter((r) => !r.account.closed) // withdrawn-in-full streams no longer hold any supply
      .map(({ account: stream }) => {
        const deposited = stream.depositedAmount;
        if (deposited.isZero()) return null;

        const unlockedNow = stream.unlocked(now);
        const unlockedSoon = stream.unlocked(soon);
        const fullyUnlockedAt = stream.end ? new Date(stream.end * 1000).toISOString() : null;

        const lock: VestingLock = {
          protocol: 'streamflow',
          holder_address: stream.recipient,
          percent_of_supply: percentOf(deposited, totalSupplyBN),
          unlocked_now_percent: percentOf(unlockedNow, deposited),
          unlocks_within_30d_percent: percentOf(unlockedSoon, deposited),
          next_unlock_at:
            unlockedNow.lt(deposited) && stream.start ? new Date(stream.start * 1000).toISOString() : null,
          fully_unlocked_at: fullyUnlockedAt,
          cancelable_by_sender: stream.cancelableBySender,
        };
        return lock;
      })
      .filter((l): l is VestingLock => l !== null);
  } catch (error) {
    console.error('[vesting-lock-detector] Streamflow search failed:', (error as Error).message);
    return [];
  }
}

// The "freely tradeable" fraction of a lock's holding, for feeding into
// concentration-risk math (holder-distribution.ts's top10Percent). A
// stream the sender can cancel is treated as fully free — see file
// header for why. Otherwise: whatever isn't unlocked within the next
// 30 days is treated as genuinely locked (subtracted from risk), and
// whatever unlocks sooner counts as free (a near-term dump is a real,
// current risk regardless of the nominal "still vesting" label).
export function freelyTradeablePercentOfLock(lock: VestingLock): number {
  if (lock.cancelable_by_sender) return lock.percent_of_supply;
  const freeFraction = lock.unlocks_within_30d_percent / 100;
  return Math.round(lock.percent_of_supply * freeFraction * 10) / 10;
}
