// Version 6.9 — lib/insider-cluster-detector.ts
//
// v6.9: hardened against the same class of bug fixed in token-risk's
// main path (see lib/with-timeout.ts) — RugCheck and the per-holder RPC
// walk had no timeout, so a hang on any single call could stall this
// entire background job. RugCheck's fetch now has an AbortSignal
// timeout; each holder's signature-history walk is capped with
// withTimeout so one slow/bad wallet is skipped (logged as an error)
// instead of stalling the other holders behind it.
//
// Standalone "First Funder Trace" insider-cluster detector.
//
// This is a NEW file. It does not modify app/api/cluster-check/route.js —
// that route keeps working exactly as before for the public site.
//
// Why a separate module instead of importing the existing route:
// 1. Next.js route files aren't meant to be imported as libraries.
// 2. cluster-check/route.js has a site-specific side effect — it writes
//    a penalty score into the `listed_tokens` table. A paid Risk-Data API
//    hit by trading bots should NOT trigger that write on every call.
// This module contains only the pure on-chain detection logic, reusable
// by both features going forward.
//
// Logic: for a token's top holders, find each wallet's very first
// incoming SOL transfer (its "funder"). If the same funder wallet funded
// 2+ of the checked top holders, that's an on-chain-provable insider/
// sniper cluster signal — no paid third-party API (Nansen/Arkham) needed.

import { Connection, PublicKey } from '@solana/web3.js';
import { withTimeout } from '@/lib/with-timeout';

const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RUGCHECK_URL = 'https://api.rugcheck.xyz/v1/tokens';

// Safety caps so one request can't hammer the RPC forever on an old/busy wallet.
const MAX_HOLDERS_CHECKED = 10;
const MAX_SIG_PAGES = 3; // 3 * 1000 = up to 3000 signatures back per wallet
const SIG_PAGE_SIZE = 1000;

const RUGCHECK_TIMEOUT_MS = 10000;
const PER_HOLDER_TIMEOUT_MS = 15000;

export interface InsiderCluster {
  funder: string;
  wallets: string[];
}

export interface InsiderClusterDetectionResult {
  clusters: InsiderCluster[];
  checkedHolders: number;
  errors: Array<{ holder: string; error: string }>;
}

interface SignatureInfo {
  signature: string;
}

// Walk a wallet's signature history backwards (oldest last) to find its
// very first transaction signature.
async function findOldestSignature(
  connection: Connection,
  pubkey: PublicKey,
): Promise<string | null> {
  let before: string | undefined = undefined;
  let oldest: SignatureInfo | null = null;

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
async function findFunderFromTx(
  connection: Connection,
  walletAddress: string,
  signature: string,
): Promise<string | null> {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || !tx.meta) return null;

  const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
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

// Main entry point: detect insider clusters among a mint's top holders.
export async function detectInsiderClusters(
  mint: string,
): Promise<InsiderClusterDetectionResult> {
  const rugRes = await fetch(`${RUGCHECK_URL}/${mint}/report`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(RUGCHECK_TIMEOUT_MS),
  });

  if (!rugRes.ok) {
    throw new Error('Could not fetch holder data for this token (RugCheck upstream error)');
  }

  const rugData = await rugRes.json();
  const topHolders: string[] = (rugData.topHolders || [])
    .slice(0, MAX_HOLDERS_CHECKED)
    .map((h: any) => h.address || h.owner)
    .filter(Boolean);

  if (topHolders.length < 2) {
    return { clusters: [], checkedHolders: topHolders.length, errors: [] };
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const funderMap: Record<string, string[]> = {};
  const errors: Array<{ holder: string; error: string }> = [];

  for (const holder of topHolders) {
    try {
      const pubkey = new PublicKey(holder);
      const funder = await withTimeout(
        (async () => {
          const oldestSig = await findOldestSignature(connection, pubkey);
          if (!oldestSig) return null;
          return findFunderFromTx(connection, holder, oldestSig);
        })(),
        PER_HOLDER_TIMEOUT_MS,
        null,
      );
      if (funder) {
        if (!funderMap[funder]) funderMap[funder] = [];
        funderMap[funder].push(holder);
      }
    } catch (e: any) {
      errors.push({ holder, error: e.message || 'Unknown error' });
    }
  }

  // Only surface funders that funded 2+ of the checked top holders —
  // a single shared funding source across multiple top wallets is the
  // real, on-chain-provable insider/cluster signal.
  const clusters: InsiderCluster[] = Object.entries(funderMap)
    .filter(([, wallets]) => wallets.length >= 2)
    .map(([funder, wallets]) => ({ funder, wallets }));

  return { clusters, checkedHolders: topHolders.length, errors };
}
