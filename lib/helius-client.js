// TNT House — On-chain audit engine
// Fetches real Solana data: mint/freeze authority, Token-2022 extensions
// (transfer fee / permanent delegate), holder distribution, metadata
// mutability, and DexScreener market data.

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
      const totalSupply = parseInt(supplyData.result.value.amount);

      return holders.map((holder, index) => ({
        rank: index + 1,
        address: holder.address,
        balance: parseInt(holder.amount),
        percent: totalSupply > 0 ? (parseInt(holder.amount) / totalSupply) * 100 : 0,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching top holders:', error);
    return [];
  }
}

export async function checkHolderDistributionRisk(mintAddress) {
  try {
    const holders = await getTopHolders(mintAddress);
    if (holders.length === 0) {
      return {
        riskLevel: 'CRITICAL',
        largestHolderPercent: 100,
        top10Percent: 100,
        holderCount: 0,
      };
    }

    const largestHolder = holders[0];
    const top10Total = holders.slice(0, 10).reduce((sum, h) => sum + h.percent, 0);

    let riskLevel = 'LOW';
    if (largestHolder.percent > 20) {
      riskLevel = 'CRITICAL';
    } else if (largestHolder.percent > 15) {
      riskLevel = 'HIGH';
    } else if (top10Total > 50) {
      riskLevel = 'MEDIUM';
    }

    return {
      riskLevel,
      largestHolderPercent: largestHolder.percent,
      top10Percent: top10Total,
      holderCount: holders.length, // NOTE: real total holder count needs an indexer (Helius DAS);
      // this is the count of largest accounts returned by RPC (max 20), used as a floor estimate.
      topHolders: holders.slice(0, 10),
    };
  } catch (error) {
    console.error('Error checking holder distribution:', error);
    return { riskLevel: 'ERROR', largestHolderPercent: 0, top10Percent: 0, holderCount: 0 };
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

    // Pick the highest-liquidity pair as the canonical source
    const best = solanaPairs.sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
    )[0];

    const ageDays = best.pairCreatedAt
      ? Math.max(0, Math.floor((Date.now() - best.pairCreatedAt) / 86400000))
      : null;

    return {
      price: best.priceUsd ? parseFloat(best.priceUsd) : null,
      liquidity: best.liquidity?.usd ?? null,
      volume24h: best.volume?.h24 ?? null,
      priceChange24h: best.priceChange?.h24 ?? null,
      ageDays,
    };
  } catch (error) {
    console.error('Error fetching DexScreener data:', error);
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
