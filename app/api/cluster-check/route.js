// app/api/cluster-check/route.js
// Version 1.1
// First Funder Trace: for a token's top holders, find each wallet's very
// first incoming SOL transfer (its "funder"). If multiple top holders
// were funded by the SAME wallet, that's a real, on-chain-provable signal
// they're controlled by the same person — a classic insider/sniper
// cluster pattern for fresh Solana memecoins.
//
// No third-party paid API (Nansen/Arkham) needed — just raw Solana RPC
// (getSignaturesForAddress + getTransaction), which Helius's free tier
// covers fine for the shallow history typical of fresh token holders.

import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';

// Safety caps so one request can't hammer the RPC forever on an old/busy wallet.
const MAX_HOLDERS_CHECKED = 10;
const MAX_SIG_PAGES = 3; // 3 * 1000 = up to 3000 signatures back per wallet
const SIG_PAGE_SIZE = 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Walk a wallet's signature history backwards (oldest last) to find its
// very first transaction signature.
async function findOldestSignature(connection, pubkey) {
  let before = undefined;
  let oldest = null;
  for (let page = 0; page < MAX_SIG_PAGES; page++) {
    const sigs = await connection.getSignaturesForAddress(pubkey, {
      limit: SIG_PAGE_SIZE,
      before,
    });
    if (sigs.length === 0) break;
    oldest = sigs[sigs.length - 1];
    if (sigs.length < SIG_PAGE_SIZE) break; // reached the actual start of history
    before = oldest.signature;
  }
  return oldest ? oldest.signature : null;
}

// Given a wallet's first transaction, find which OTHER account's SOL
// balance decreased while this wallet's balance increased — that's the
// real funder, read directly from the transaction's balance deltas.
async function findFunderFromTx(connection, walletAddress, signature) {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || !tx.meta) return null;
  const accountKeys = tx.transaction.message.accountKeys.map((k) =>
    typeof k === 'string' ? k : k.pubkey.toString(),
  );
  const walletIndex = accountKeys.indexOf(walletAddress);
  if (walletIndex === -1) return null;
  const preBalances = tx.meta.preBalances;
  const postBalances = tx.meta.postBalances;
  const walletGained = postBalances[walletIndex] - preBalances[walletIndex];
  if (walletGained <= 0) return null; // this tx wasn't the wallet receiving funds

  // Find an account whose balance dropped by roughly the amount this
  // wallet gained (accounting for a small fee margin).
  for (let i = 0; i < accountKeys.length; i++) {
    if (i === walletIndex) continue;
    const delta = postBalances[i] - preBalances[i];
    if (delta < 0 && Math.abs(delta) >= walletGained * 0.9) {
      return accountKeys[i];
    }
  }
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ca = searchParams.get('ca');
    if (!ca) {
      return NextResponse.json({ error: 'ca param required' }, { status: 400, headers: CORS_HEADERS });
    }

    const rugRes = await fetch(RUGCHECK_URL + '/' + ca + '/report', {
      headers: { Accept: 'application/json' },
    });
    if (!rugRes.ok) {
      return NextResponse.json(
        { error: 'Could not fetch holder data for this token' },
        { status: 502, headers: CORS_HEADERS },
      );
    }
    const rugData = await rugRes.json();
    const topHolders = (rugData.topHolders || [])
      .slice(0, MAX_HOLDERS_CHECKED)
      .map((h) => h.address || h.owner)
      .filter(Boolean);

    if (topHolders.length < 2) {
      return NextResponse.json({ clusters: [], checked: topHolders.length, note: 'Not enough holder data' }, {
        headers: CORS_HEADERS,
      });
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const funderMap = {}; // funder address -> [holder addresses]
    const errors = [];

    for (const holder of topHolders) {
      try {
        const pubkey = new PublicKey(holder);
        const oldestSig = await findOldestSignature(connection, pubkey);
        if (!oldestSig) continue;
        const funder = await findFunderFromTx(connection, holder, oldestSig);
        if (funder) {
          if (!funderMap[funder]) funderMap[funder] = [];
          funderMap[funder].push(holder);
        }
      } catch (e) {
        errors.push({ holder, error: e.message });
      }
    }

    // Only surface funders that funded 2+ of the checked top holders —
    // a single shared funding source across multiple top wallets is the
    // real, on-chain-provable insider/cluster signal.
    const clusters = Object.entries(funderMap)
      .filter(([, holders]) => holders.length >= 2)
      .map(([funder, holders]) => ({ funder, holders }));

    return NextResponse.json(
      {
        checked: topHolders.length,
        clusters,
        clusterCount: clusters.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}
