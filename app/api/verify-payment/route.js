// app/api/verify-payment/route.js
// v4 - Multiple verification strategies: Enhanced Txs, getSignaturesForAddress, getTokenAccountBalance

export const runtime = 'edge';

const WALLET_ADDRESS = "Ev6oXBXo6qyoaT5wypJ2Umxch91F7cFvE1SarYLaUn8Z";
const MRDT_CA = "8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Derive Associated Token Account from wallet and mint
function deriveATA(walletPubkey, tokenMint) {
  // This is a simplified approach - in production use proper ATA derivation
  // For now, Helius will handle it in API responses
  return null; // Will use Helius tokenAccounts API instead
}

// Strategy 1: Try Helius Enhanced Transactions API (if available)
async function verifyWithEnhancedTxs(heliusKey, expectedAmount, sinceSeconds) {
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${WALLET_ADDRESS}/transactions?api-key=${heliusKey}&limit=30`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    if (!res.ok) return null;

    const txs = await res.json();
    if (!Array.isArray(txs) || txs.length === 0) return null;

    // Filter by timestamp
    const recentTxs = txs.filter(tx => tx.timestamp && tx.timestamp >= sinceSeconds);

    for (const tx of recentTxs) {
      // Check tokenTransfers array
      if (Array.isArray(tx.tokenTransfers)) {
        for (const transfer of tx.tokenTransfers) {
          if (
            transfer.mint === MRDT_CA &&
            transfer.toUserAccount === WALLET_ADDRESS &&
            parseFloat(transfer.tokenAmount) >= expectedAmount * 0.95
          ) {
            return {
              verified: true,
              received: parseFloat(transfer.tokenAmount),
              expected: expectedAmount,
              signature: tx.signature,
              method: 'enhancedTxs'
            };
          }
        }
      }

      // Check accountData tokenBalanceChanges
      if (Array.isArray(tx.accountData)) {
        for (const account of tx.accountData) {
          if (account.account === WALLET_ADDRESS && Array.isArray(account.tokenBalanceChanges)) {
            for (const change of account.tokenBalanceChanges) {
              if (change.mint === MRDT_CA) {
                const received = parseFloat(change.rawTokenAmount?.uiAmount || 0);
                if (received > 0 && received >= expectedAmount * 0.95) {
                  return {
                    verified: true,
                    received,
                    expected: expectedAmount,
                    signature: tx.signature,
                    method: 'accountData'
                  };
                }
              }
            }
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.log('Enhanced Txs failed:', e.message);
    return null;
  }
}

// Strategy 2: Use getSignaturesForAddress + getTransaction (slower but reliable)
async function verifyWithSignatures(rpcUrl, expectedAmount, sinceSeconds) {
  try {
    // Get transaction signatures for our wallet
    const sigRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          WALLET_ADDRESS,
          { limit: 30 }
        ]
      })
    });

    const sigData = await sigRes.json();
    if (!sigData.result || !Array.isArray(sigData.result)) return null;

    // Filter by timestamp
    const recentSigs = sigData.result.filter(sig => {
      const blockTime = sig.blockTime || 0;
      return blockTime >= sinceSeconds;
    });

    if (recentSigs.length === 0) return null;

    // Check each transaction
    for (const sigInfo of recentSigs) {
      const txRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [sigInfo.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
        })
      });

      const txData = await txRes.json();
      if (!txData.result) continue;

      const tx = txData.result;
      const postTokenBalances = tx.meta?.postTokenBalances || [];

      // Find token account changes for MRDT
      for (const balance of postTokenBalances) {
        if (balance.mint === MRDT_CA && balance.owner === WALLET_ADDRESS) {
          const amount = parseFloat(balance.uiTokenAmount?.uiAmount || 0);
          if (amount >= expectedAmount * 0.95) {
            // Double-check preTokenBalances to confirm it's an increase
            const preTokenBalances = tx.meta?.preTokenBalances || [];
            const preBalance = preTokenBalances.find(b => b.mint === MRDT_CA && b.owner === WALLET_ADDRESS);
            const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount?.uiAmount || 0) : 0;

            if (amount > preAmount) {
              return {
                verified: true,
                received: amount,
                expected: expectedAmount,
                signature: sigInfo.signature,
                method: 'signatures'
              };
            }
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.log('Signatures method failed:', e.message);
    return null;
  }
}

// Strategy 3: Check current ATA balance (quick sanity check)
async function verifyWithBalance(heliusKey, expectedAmount) {
  try {
    // Get all token accounts for our wallet with MRDT mint
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${WALLET_ADDRESS}/token-accounts?api-key=${heliusKey}&mint=${MRDT_CA}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    if (!res.ok) return null;

    const accounts = await res.json();
    if (!Array.isArray(accounts) || accounts.length === 0) return null;

    // Check if any MRDT token account has received funds
    for (const account of accounts) {
      const balance = parseFloat(account.tokenAmount?.uiAmount || 0);
      if (balance >= expectedAmount * 0.95) {
        return {
          verified: true,
          received: balance,
          expected: expectedAmount,
          method: 'balance',
          timestamp: new Date().toISOString()
        };
      }
    }

    return null;
  } catch (e) {
    console.log('Balance check failed:', e.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { expectedAmount, since } = body;

    if (!expectedAmount || !since) {
      return Response.json(
        { verified: false, reason: 'Missing expectedAmount or since' },
        { status: 400 }
      );
    }

    const heliusKey = process.env.HELIUS_API_KEY;
    const rpcUrl = process.env.SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;

    if (!heliusKey) {
      return Response.json(
        { verified: false, reason: 'Missing HELIUS_API_KEY' },
        { status: 500 }
      );
    }

    const sinceSeconds = Math.floor(since / 1000) - 60; // 60s buffer for blockchain latency

    // Try strategies in order
    console.log(`[verify-payment] Checking for ${expectedAmount} MRDT since ${sinceSeconds}`);

    // Strategy 1: Enhanced Txs (fastest if available)
    let result = await verifyWithEnhancedTxs(heliusKey, expectedAmount, sinceSeconds);
    if (result) {
      console.log('[verify-payment] ✓ Verified via Enhanced Txs');
      return Response.json(result);
    }

    // Strategy 2: Signatures + getTransaction (most reliable)
    result = await verifyWithSignatures(rpcUrl, expectedAmount, sinceSeconds);
    if (result) {
      console.log('[verify-payment] ✓ Verified via Signatures method');
      return Response.json(result);
    }

    // Strategy 3: Quick balance check (covers edge cases)
    result = await verifyWithBalance(heliusKey, expectedAmount);
    if (result) {
      console.log('[verify-payment] ✓ Verified via Balance check');
      return Response.json(result);
    }

    // All strategies failed
    return Response.json({
      verified: false,
      reason: 'Payment not found in any verification method',
      expectedAmount,
      sinceSeconds,
      debug: { strategies: ['enhancedTxs', 'signatures', 'balance'] }
    });

  } catch (e) {
    console.error('[verify-payment] Error:', e.message);
    return Response.json(
      { verified: false, reason: 'Server error: ' + e.message },
      { status: 500 }
    );
  }
}
