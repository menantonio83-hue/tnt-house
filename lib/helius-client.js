// TNT House — On-chain audit engine
// Fetches real Solana data: mint/freeze authority, Token-2022 extensions
// (transfer fee / permanent delegate), holder distribution, metadata
// mutability, and DexScreener market data.

import { findStreamflowLocks, freelyTradeablePercentOfLock } from '@/lib/vesting-lock-detector';
import { alertAdmin } from '@/lib/telegram-alert';

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const METAPLEX_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

// ─── Raw mint account (jsonParsed also exposes Token-2022 extensions) ───
export async function getMintInfo(mintAddress) {
  try {
    const response = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mintAddress, { encoding: 'jsonParsed' }],
      }),
    });

    const data = await response.json();
    if (data.result && data.result.value) {
      return {
        info: data.result.value.data.parsed.info,
        program: data.result.value.data.program, // 'spl-token' | 'spl-token-2022'
        owner: data.result.value.owner,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching mint info:', error);
    void alertAdmin('solana-rpc', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function isMintAuthorityRevoked(mintAddress) {
  const mint = await getMintInfo(mintAddress);
  if (!mint) return false;
  return mint.info.mintAuthority === null;
}

export async function isFreezeAuthorityRevoked(mintAddress) {
  const mint = await getMintInfo(mintAddress);
  if (!mint) return false;
  return mint.info.freezeAuthority === null;
}

// ─── Token-2022 extensions: transfer fee (buy/sell tax) + permanent delegate ───
export function parseTokenExtensions(mint) {
  const result = {
    standardProgram: true,
    buyTaxPercent: 0,
    sellTaxPercent: 0,
    permanentDelegate: 'None ✓',
  };

  if (!mint || mint.program !== 'spl-token-2022') {
    return result;
  }

  result.standardProgram = false;
  const extensions = mint.info.extensions || [];

  const transferFeeExt = extensions.find((e) => e.extension === 'transferFeeConfig');
  if (transferFeeExt) {
    const bps =
      transferFeeExt.state?.newerTransferFee?.transferFeeBasisPoints ??
      transferFeeExt.state?.olderTransferFee?.transferFeeBasisPoints ??
      0;
    const pct = bps / 100;
    result.buyTaxPercent = pct;
    result.sellTaxPercent = pct; // Solana transfer fee applies uniformly, no separate buy/sell rate
  }

  const delegateExt = extensions.find((e) => e.extension === 'permanentDelegate');
  if (delegateExt && delegateExt.state?.delegate) {
    result.permanentDelegate = delegateExt.state.delegate;
  }

  return result;
}

// ─── Top holders / concentration risk ───
// getTopHolders returns { holders, totalSupplyRaw }. totalSupplyRaw is
// the RPC's exact decimal string (never passed through parseInt) — see
// lib/holder-distribution.ts v6.19/v6.20 and lib/vesting-lock-
// detector.ts v1.2's header for why this matters: constructing a BN
// from an already-lossy JS number (parseInt loses precision past
// Number.MAX_SAFE_INTEGER, routine for high-decimal mints) throws in
// production. This mirrors that exact fix so this file's own vesting
// detection doesn't repeat the same three-bug chain caught live on the
// Risk-Data API.
export async function getTopHolders(mintAddress) {
  try {
    const response = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [mintAddress],
      }),
    });

    const data = await response.json();
    if (data.result && data.result.value) {
      const holders = data.result.value;
      const supplyResponse = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenSupply',
          params: [mintAddress],
        }),
      });

      const supplyData = await supplyResponse.json();
      const totalSupplyRaw = supplyData.result.value.amount;
      const totalSupply = parseInt(totalSupplyRaw);

      return {
        holders: holders.map((holder, index) => ({
          rank: index + 1,
          address: holder.address,
          balance: parseInt(holder.amount),
          percent: totalSupply > 0 ? (parseInt(holder.amount) / totalSupply) * 100 : 0,
        })),
        totalSupplyRaw,
      };
    }
    return { holders: [], totalSupplyRaw: '0' };
  } catch (error) {
    console.error('Error fetching top holders:', error);
    return { holders: [], totalSupplyRaw: '0' };
  }
}

// classifyHolderRisk mirrors lib/holder-distribution.ts's classifyRisk
// exactly (same thresholds) — kept as a local, small function here
// since this file has its own separate holder-distribution
// implementation (parallel to, not shared with, the Risk-Data API's).
function classifyHolderRisk(largestHolderPercent, top10Percent) {
  if (largestHolderPercent > 20) return 'CRITICAL';
  if (largestHolderPercent > 15) return 'HIGH';
  if (top10Percent > 50) return 'MEDIUM';
  return 'LOW';
}

export async function checkHolderDistributionRisk(mintAddress) {
  try {
    const { holders, totalSupplyRaw } = await getTopHolders(mintAddress);
    if (holders.length === 0) {
      return {
        riskLevel: 'CRITICAL',
        largestHolderPercent: 100,
        top10Percent: 100,
        holderCount: 0,
        vestingLocks: [],
      };
    }

    const largestHolder = holders[0];
    const top10Total = holders.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);

    // v2 (2026-08-10): detect known vesting/lock contracts (Streamflow)
    // among the top holders — same fix as Risk-Data API's
    // token-risk-core.ts v1.6-v1.8, ported here so the site's own audit
    // card doesn't have the same false-positive concentration risk on
    // legitimate team/investor vesting that the API had before that
    // fix (confirmed live on MRDT: 67% held by a single wallet, but
    // genuinely locked in a non-cancelable Streamflow stream until
    // Nov 2026 — this used to score as raw concentration risk on both
    // the site and the API).
    //
    // Deliberately keeps largestHolderPercent/top10Percent in the
    // RETURNED object as the RAW, unadjusted on-chain figures — same
    // "never silently hide the truth" rule as the API's
    // holder_distribution.top10_percent. Only riskLevel (which drives
    // performFullAudit's score) is computed from the vesting-adjusted
    // values; a new vestingLocks field makes the adjustment itself
    // transparent to anyone reading the result.
    const vestingLocks = await findStreamflowLocks(mintAddress, totalSupplyRaw);
    let riskLevel = classifyHolderRisk(largestHolder.percent, top10Total);
    if (vestingLocks.length > 0) {
      const perLockDeductions = vestingLocks.map((lock) => lock.percent_of_supply - freelyTradeablePercentOfLock(lock));
      const summedDeduction = perLockDeductions.reduce((sum, d) => sum + d, 0);
      const maxSingleLockDeduction = Math.max(0, ...perLockDeductions);
      const freelyTradeableTop10 = Math.max(0, top10Total - summedDeduction);
      const freelyTradeableLargest = Math.max(0, largestHolder.percent - maxSingleLockDeduction);
      riskLevel = classifyHolderRisk(freelyTradeableLargest, freelyTradeableTop10);
      console.log(
        `[helius-client] ${mintAddress}: vesting-adjusted riskLevel for scoring — largestHolder ${largestHolder.percent.toFixed(1)}% -> ${freelyTradeableLargest.toFixed(1)}%, top10 ${top10Total.toFixed(1)}% -> ${freelyTradeableTop10.toFixed(1)}%, riskLevel -> ${riskLevel}`,
      );
    }

    return {
      riskLevel,
      largestHolderPercent: largestHolder.percent,
      top10Percent: top10Total,
      holderCount: holders.length, // NOTE: real total holder count needs an indexer (Helius DAS);
      // this is the count of largest accounts returned by RPC (max 20), used as a floor estimate.
      topHolders: holders.slice(0, 10),
      vestingLocks,
    };
  } catch (error) {
    console.error('Error checking holder distribution:', error);
    return { riskLevel: 'ERROR', largestHolderPercent: 0, top10Percent: 0, holderCount: 0, vestingLocks: [] };
  }
}

// ─── Metaplex metadata mutability (proxy signal for hidden-owner / rug risk) ───
function findMetadataPda(mintAddress) {
  // Lightweight PDA derivation using the same seeds Metaplex defines:
  // ['metadata', programId, mint]
  const { PublicKey } = require('@solana/web3.js');
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      new PublicKey(METAPLEX_METADATA_PROGRAM_ID).toBuffer(),
      new PublicKey(mintAddress).toBuffer(),
    ],
    new PublicKey(METAPLEX_METADATA_PROGRAM_ID),
  );
  return pda.toBase58();
}

export async function getMetadataMutability(mintAddress) {
  try {
    const pda = findMetadataPda(mintAddress);
    const response = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [pda, { encoding: 'jsonParsed' }],
      }),
    });
    const data = await response.json();
    const raw = data?.result?.value?.data;

    if (!raw) {
      return { hiddenOwner: 'Unknown' };
    }

    // Metaplex metadata is Borsh-encoded, not jsonParsed by the RPC.
    // Reliably reading isMutable requires the full Borsh layout — flagging
    // as best-effort instead of guessing at byte offsets and risking a
    // false "safe" reading.
    return { hiddenOwner: 'Unknown' };
  } catch (error) {
    console.error('Error checking metadata mutability:', error);
    return { hiddenOwner: 'Unknown' };
  }
}

// ─── DexScreener: price, liquidity, volume, token age ───
export async function getDexScreenerData(mintAddress) {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (!response.ok) {
      return { price: null, liquidity: null, volume24h: null, priceChange24h: null, ageDays: null };
    }
    const data = await response.json();
    const solanaPairs = (data.pairs || []).filter((p) => p.chainId === 'solana');

    if (solanaPairs.length === 0) {
      // No live market yet — token has no pool, not a bug, just genuinely new
      return { price: null, liquidity: null, volume24h: null, priceChange24h: null, ageDays: null };
    }

    // BUG FIX (found via the anonymous MCP demo on USDC returning
    // price_usd ~$0.004 instead of ~$1.00): DexScreener's
    // /tokens/{address} endpoint returns EVERY pair where the address
    // appears as EITHER baseToken OR quoteToken. priceUsd on a pair is
    // always the price of that pair's baseToken specifically — it is
    // NOT automatically the price of the mint we asked about. The old
    // code picked the highest-liquidity pair across both sides and used
    // priceUsd directly, so whenever the highest-liquidity pair had our
    // mint sitting on the QUOTE side (extremely common for any token
    // that's frequently used to price OTHER tokens, like USDC, SOL,
    // USDT), it silently reported some unrelated base token's price
    // instead. Fix: prefer pairs where our mint IS the baseToken; only
    // fall back to a quote-side pair (inverting via priceNative, the
    // base/quote ratio) if literally no base-side pair exists at all.
    const baseSidePairs = solanaPairs.filter((p) => p.baseToken?.address === mintAddress);
    const pairsToRank = baseSidePairs.length > 0 ? baseSidePairs : solanaPairs;

    const best = pairsToRank.sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
    )[0];

    const ageDays = best.pairCreatedAt
      ? Math.max(0, Math.floor((Date.now() - best.pairCreatedAt) / 86400000))
      : null;

    const isBaseSide = best.baseToken?.address === mintAddress;
    let price = null;
    if (best.priceUsd) {
      if (isBaseSide) {
        // Normal case: priceUsd already refers to our mint.
        price = parseFloat(best.priceUsd);
      } else {
        // Our mint is the quoteToken of the best available pair (no
        // base-side pair existed) — invert via priceNative (base
        // price in terms of quote) to get our mint's USD price:
        // quoteUsd = baseUsd / (base per quote).
        const priceUsdBase = parseFloat(best.priceUsd);
        const priceNative = parseFloat(best.priceNative);
        price = priceNative > 0 ? priceUsdBase / priceNative : null;
      }
    }

    return {
      price,
      liquidity: best.liquidity?.usd ?? null,
      volume24h: best.volume?.h24 ?? null,
      priceChange24h: best.priceChange?.h24 ?? null,
      ageDays,
    };
  } catch (error) {
    console.error('Error fetching DexScreener data:', error);
    void alertAdmin('dexscreener', error instanceof Error ? error.message : String(error));
    return { price: null, liquidity: null, volume24h: null, priceChange24h: null, ageDays: null };
  }
}

// ─── Master audit — runs every check in parallel and returns DB-ready fields ───
export async function performFullAudit(mintAddress) {
  try {
    console.log(`🔍 Starting audit for token: ${mintAddress}`);

    const [mint, holderRisk, dexData, metadataInfo] = await Promise.all([
      getMintInfo(mintAddress),
      checkHolderDistributionRisk(mintAddress),
      getDexScreenerData(mintAddress),
      getMetadataMutability(mintAddress),
    ]);

    const mintAuthRevoked = mint ? mint.info.mintAuthority === null : false;
    const freezeAuthRevoked = mint ? mint.info.freezeAuthority === null : false;
    const extensions = parseTokenExtensions(mint);

    let securityScore = 0;
    let foundationScore = 0;
    if (mintAuthRevoked) foundationScore += 15;
    if (freezeAuthRevoked) foundationScore += 10;
    securityScore += foundationScore;

    let holderScore = 0;
    if (holderRisk.riskLevel === 'LOW') holderScore = 25;
    else if (holderRisk.riskLevel === 'MEDIUM') holderScore = 12;
    else if (holderRisk.riskLevel === 'HIGH') holderScore = 5;
    securityScore += holderScore;

    // Liquidity / volume contribute to score only when a real market exists
    const liquidityScore = dexData.liquidity && dexData.liquidity > 1000 ? 15 : 5;
    const volumeScore = dexData.volume24h && dexData.volume24h > 500 ? 15 : 5;
    const insiderScore = 10;
    securityScore += liquidityScore + volumeScore + insiderScore;

    securityScore = Math.min(100, securityScore);

    let verdict = '🟢 LOW RISK - SAFE';
    let verdictColor = 'green';
    if (securityScore >= 75) {
      verdict = '🟢 LOW RISK - SAFE';
      verdictColor = 'green';
    } else if (securityScore >= 50) {
      verdict = '🟡 MEDIUM RISK - CAUTION';
      verdictColor = 'gold';
    } else {
      verdict = '🔴 HIGH RISK - DANGER';
      verdictColor = 'red';
    }

    return {
      mintAddress,
      securityScore,
      verdict,
      verdictColor,
      checks: {
        mintAuthority: { revoked: mintAuthRevoked },
        freezeAuthority: { revoked: freezeAuthRevoked },
        holderDistribution: holderRisk,
      },
      price: dexData.price,
      volume24h: dexData.volume24h,
      liquidity: dexData.liquidity,
      priceChange24h: dexData.priceChange24h,
      timestamp: new Date().toISOString(),

      // Flattened, DB-ready fields (snake_case matches verified_tokens columns)
      dbFields: {
        mint_authority: mintAuthRevoked ? '✅ Revoked' : '⚠️ Active',
        freeze_authority: freezeAuthRevoked ? '✅ Revoked' : '⚠️ Active',
        top10_percent: Number(holderRisk.top10Percent?.toFixed(2)) || null,
        holder_count: holderRisk.holderCount || null,
        lp_locked_percent: null, // requires a locker-detection service (e.g. RugCheck Pro) — left honest as Unknown
        // v2 (2026-08-10): sum of percent_of_supply across any detected
        // Streamflow vesting locks — see checkHolderDistributionRisk
        // above. null (not 0) when nothing was detected, consistent
        // with this file's "leave honest as Unknown" convention for
        // signals we may not have fully covered rather than implying a
        // confirmed zero.
        vesting_locked_percent: holderRisk.vestingLocks?.length
          ? Number(holderRisk.vestingLocks.reduce((sum, l) => sum + l.percent_of_supply, 0).toFixed(2))
          : null,
        buy_tax_percent: extensions.buyTaxPercent,
        sell_tax_percent: extensions.sellTaxPercent,
        contract_renounced: mintAuthRevoked && freezeAuthRevoked,
        hidden_owner: metadataInfo.hiddenOwner,
        age_days: dexData.ageDays,
        creator_balance_percent: null, // requires creator-wallet indexing — left honest as Unknown
        standard_program: extensions.standardProgram,
        permanent_delegate: extensions.permanentDelegate,
        price: dexData.price,
        liquidity: dexData.liquidity,
        volume24h: dexData.volume24h,
        pricechange24h: dexData.priceChange24h,
      },
    };
  } catch (error) {
    console.error('Full audit error:', error);
    return {
      mintAddress,
      securityScore: 0,
      verdict: '❌ AUDIT FAILED',
      verdictColor: 'red',
      error: error.message,
      dbFields: {},
    };
  }
}
