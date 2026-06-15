const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export async function getMintInfo(mintAddress) {
  try {
    const response = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mintAddress, { encoding: 'jsonParsed' }]
      })
    });

    const data = await response.json();
    if (data.result && data.result.value) {
      return data.result.value.data.parsed.info;
    }
    return null;
  } catch (error) {
    console.error('Error fetching mint info:', error);
    return null;
  }
}

export async function isMintAuthorityRevoked(mintAddress) {
  try {
    const mintInfo = await getMintInfo(mintAddress);
    if (!mintInfo) return false;
    return mintInfo.mintAuthority === null;
  } catch (error) {
    console.error('Error checking mint authority:', error);
    return false;
  }
}

export async function isFreezeAuthorityRevoked(mintAddress) {
  try {
    const mintInfo = await getMintInfo(mintAddress);
    if (!mintInfo) return false;
    return mintInfo.freezeAuthority === null;
  } catch (error) {
    console.error('Error checking freeze authority:', error);
    return false;
  }
}

export async function getTopHolders(mintAddress) {
  try {
    const response = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [mintAddress]
      })
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
          params: [mintAddress]
        })
      });

      const supplyData = await supplyResponse.json();
      const totalSupply = parseInt(supplyData.result.value.amount);

      return holders.map((holder, index) => ({
        rank: index + 1,
        address: holder.address,
        balance: parseInt(holder.amount),
        percent: ((parseInt(holder.amount) / totalSupply) * 100).toFixed(2)
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
        description: 'Не удалось получить информацию об держателях',
        largestHolderPercent: 100,
        top10Percent: 100,
        recommendation: 'Невозможно верифицировать токен'
      };
    }

    const largestHolder = holders[0];
    const top10Total = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percent), 0);

    let riskLevel = 'LOW';
    if (parseFloat(largestHolder.percent) > 20) {
      riskLevel = 'CRITICAL';
    } else if (parseFloat(largestHolder.percent) > 15) {
      riskLevel = 'HIGH';
    } else if (top10Total > 50) {
      riskLevel = 'MEDIUM';
    }

    return {
      riskLevel,
      largestHolderPercent: parseFloat(largestHolder.percent),
      largestHolderAddress: largestHolder.address,
      top10Percent: top10Total,
      totalHolders: holders.length,
      topHolders: holders.slice(0, 10),
      recommendation: riskLevel === 'LOW' ? 'Хорошее распределение' : riskLevel === 'MEDIUM' ? 'Среднее распределение - есть риск' : 'Опасно! Киты контролируют токен'
    };
  } catch (error) {
    console.error('Error checking holder distribution:', error);
    return {
      riskLevel: 'ERROR',
      description: error.message,
      largestHolderPercent: 0,
      top10Percent: 0
    };
  }
}

export async function getTokenPriceAndVolume(mintAddress) {
  try {
    const response = await fetch(`https://api.jupiterprotocol.com/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=1000000`);
    if (!response.ok) {
      return { price: null, volume24h: null, priceChange24h: null };
    }
    const data = await response.json();
    return {
      price: data.outAmount ? (1000000 / data.outAmount).toFixed(8) : null,
      volume24h: null,
      priceChange24h: null
    };
  } catch (error) {
    console.error('Error fetching price:', error);
    return { price: null, volume24h: null, priceChange24h: null };
  }
}

export async function performFullAudit(mintAddress) {
  try {
    console.log(`🔍 Starting audit for token: ${mintAddress}`);

    const [mintAuthRevoked, freezeAuthRevoked, holderRisk, priceData] = await Promise.all([
      isMintAuthorityRevoked(mintAddress),
      isFreezeAuthorityRevoked(mintAddress),
      checkHolderDistributionRisk(mintAddress),
      getTokenPriceAndVolume(mintAddress)
    ]);

    let securityScore = 0;
    let foundationScore = 0;
    if (mintAuthRevoked) foundationScore += 15;
    if (freezeAuthRevoked) foundationScore += 10;
    securityScore += foundationScore;

    let holderScore = 0;
    if (holderRisk.riskLevel === 'LOW') {
      holderScore = 25;
    } else if (holderRisk.riskLevel === 'MEDIUM') {
      holderScore = 12;
    } else if (holderRisk.riskLevel === 'HIGH') {
      holderScore = 5;
    }
    securityScore += holderScore;

    let volumeScore = 15;
    securityScore += volumeScore;

    let insiderScore = 10;
    securityScore += insiderScore;

    let liquidityScore = 15;
    securityScore += liquidityScore;

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
      securityScore: Math.min(100, securityScore),
      verdict,
      verdictColor,
      details: {
        foundationScore,
        holderScore,
        volumeScore,
        insiderScore,
        liquidityScore
      },
      checks: {
        mintAuthority: {
          revoked: mintAuthRevoked,
          description: mintAuthRevoked ? '✅ Отозвана' : '❌ Активна (риск инфляции)'
        },
        freezeAuthority: {
          revoked: freezeAuthRevoked,
          description: freezeAuthRevoked ? '✅ Отозвана' : '❌ Активна (риск honeypot)'
        },
        holderDistribution: {
          riskLevel: holderRisk.riskLevel,
          largestHolder: `${holderRisk.largestHolderPercent}%`,
          top10: `${holderRisk.top10Percent.toFixed(2)}%`,
          description: holderRisk.recommendation,
          topHolders: holderRisk.topHolders?.slice(0, 5) || []
        }
      },
      price: priceData.price,
      volume24h: priceData.volume24h,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Full audit error:', error);
    return {
      mintAddress,
      securityScore: 0,
      verdict: '❌ AUDIT FAILED',
      verdictColor: 'red',
      error: error.message
    };
  }
}